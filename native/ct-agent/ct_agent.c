/*
 * ct_agent.c - Agente Nativo JVMTI Seguro y Eficiente para Minecraft (CrystalTides)
 *
 * Características:
 * 1. Clasificación Jerárquica de Hilos en Kernel (Render, Server, Netty, Audio, Workers) con MMCSS y bypass de EcoQoS.
 * 2. Supresión de Ventana "(No Responde)" vía DisableProcessWindowsGhosting.
 * 3. Prioridad de GPU HIGH en el planificador WDDM vía D3DKMTSetProcessSchedulingPriorityClass.
 * 4. Configuración flexible mediante opciones de agente (threads=on|off, gpu=high|off).
 * 5. Registro atómico y seguro de ciclo de vida en ct-agent.log.
 *
 * Compilación recomendada (MSVC):
 *   cl.exe /O2 /MT /LD /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" ct_agent.c /Fe:ct-agent.dll
 */

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <avrt.h>
#include <jvmti.h>
#include <stdio.h>
#include <string.h>

#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")

// ============================================================================
// 1. REGISTRO SEGURO DE EVENTOS (ct-agent.log)
// ============================================================================
static void LogLine(const char *fmt, ...) {
    HMODULE hMod = NULL;
    if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                            (LPCWSTR)&LogLine, &hMod)) {
        return;
    }

    WCHAR logPath[MAX_PATH];
    DWORD len = GetModuleFileNameW(hMod, logPath, MAX_PATH);
    if (len == 0 || len >= MAX_PATH) {
        return;
    }

    WCHAR *lastSlash = wcsrchr(logPath, L'\\');
    if (!lastSlash) {
        lastSlash = wcsrchr(logPath, L'/');
    }
    if (!lastSlash) {
        return;
    }

    *(lastSlash + 1) = L'\0';
    if (wcscat_s(logPath, MAX_PATH, L"ct-agent.log") != 0) {
        return;
    }

    FILE *f = NULL;
    if (_wfopen_s(&f, logPath, L"a") == 0 && f != NULL) {
        va_list args;
        va_start(args, fmt);
        vfprintf(f, fmt, args);
        va_end(args);
        fprintf(f, "\n");
        fflush(f);
        fclose(f);
    }
}

// ============================================================================
// 2. CONFIGURACIÓN Y PARSEO DE OPCIONES
// ============================================================================
static int g_optThreads = 1; // 1 = on (defecto), 0 = off
static int g_optGpu = 1;     // 1 = high (defecto), 0 = off

static void ParseOptions(const char *options) {
    if (options == NULL || *options == '\0') {
        return;
    }

    char buf[512];
    strncpy_s(buf, sizeof(buf), options, _TRUNCATE);

    char *next_token = NULL;
    char *token = strtok_s(buf, ",", &next_token);

    while (token != NULL) {
        while (*token == ' ') token++;

        char *eq = strchr(token, '=');
        if (eq == NULL) {
            LogLine("[ct-agent] Advertencia: formato de opcion invalido '%s' (se esperaba clave=valor)", token);
        } else {
            *eq = '\0';
            char *key = token;
            char *val = eq + 1;

            while (*val == ' ') val++;

            if (_stricmp(key, "threads") == 0) {
                if (_stricmp(val, "on") == 0) {
                    g_optThreads = 1;
                } else if (_stricmp(val, "off") == 0) {
                    g_optThreads = 0;
                } else {
                    LogLine("[ct-agent] Advertencia: valor invalido '%s' para 'threads' (usando defecto 'on')", val);
                    g_optThreads = 1;
                }
            } else if (_stricmp(key, "gpu") == 0) {
                if (_stricmp(val, "high") == 0) {
                    g_optGpu = 1;
                } else if (_stricmp(val, "off") == 0) {
                    g_optGpu = 0;
                } else {
                    LogLine("[ct-agent] Advertencia: valor invalido '%s' para 'gpu' (usando defecto 'high')", val);
                    g_optGpu = 1;
                }
            } else {
                LogLine("[ct-agent] Advertencia: opcion desconocida '%s=%s' (ignorada)", key, val);
            }
        }
        token = strtok_s(NULL, ",", &next_token);
    }
}

// ============================================================================
// 3. BYPASS DE WINDOWS 11 EcoQoS (ThreadPowerThrottling)
// ============================================================================
typedef struct _CT_THREAD_POWER_THROTTLING_STATE {
    ULONG Version;
    ULONG ControlMask;
    ULONG StateMask;
} CT_THREAD_POWER_THROTTLING_STATE;

typedef BOOL (WINAPI *pfnSetThreadInformation)(
    HANDLE hThread,
    int ThreadInformationClass,
    LPCVOID ThreadInformation,
    DWORD ThreadInformationSize
);

static void DisableEcoQoSOnCurrentThread(void) {
    HMODULE hKernel32 = GetModuleHandleW(L"kernel32.dll");
    if (hKernel32 != NULL) {
        pfnSetThreadInformation pSetThreadInformation = 
            (pfnSetThreadInformation)GetProcAddress(hKernel32, "SetThreadInformation");
        if (pSetThreadInformation != NULL) {
            CT_THREAD_POWER_THROTTLING_STATE throttling;
            throttling.Version = 1;
            throttling.ControlMask = 0x1; // THREAD_POWER_THROTTLING_EXECUTION_SPEED
            throttling.StateMask = 0x0;   // 0 = Desactivar limitacion de velocidad
            pSetThreadInformation(GetCurrentThread(), 1 /* ThreadPowerThrottling */, &throttling, sizeof(throttling));
        }
    }
}

// ============================================================================
// 4. JERARQUÍA Y PRIORIZACIÓN DE HILOS
// ============================================================================
static __declspec(thread) HANDLE t_hMmcss = NULL;

static void OptimizeRenderThread(void) {
    DWORD taskIndex = 0;
    HANDLE hMmcss = AvSetMmThreadCharacteristicsW(L"Games", &taskIndex);
    if (hMmcss != NULL) {
        AvSetMmThreadPriority(hMmcss, AVRT_PRIORITY_HIGH);
        t_hMmcss = hMmcss;
    }
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
    DisableEcoQoSOnCurrentThread();
}

static void OptimizeServerThread(void) {
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
    DisableEcoQoSOnCurrentThread();
}

static void OptimizeAudioThread(void) {
    DWORD taskIndex = 0;
    HANDLE hMmcss = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);
    if (hMmcss != NULL) {
        AvSetMmThreadPriority(hMmcss, AVRT_PRIORITY_NORMAL);
        t_hMmcss = hMmcss;
    }
}

static void OptimizeWorkerThread(void) {
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
}

static void OptimizeThreadByName(const char *threadName) {
    if (threadName == NULL || !g_optThreads) return;

    if (strcmp(threadName, "Render thread") == 0 || strcmp(threadName, "Client thread") == 0) {
        OptimizeRenderThread();
    } else if (strcmp(threadName, "Server thread") == 0 || strncmp(threadName, "Netty", 5) == 0) {
        OptimizeServerThread();
    } else if (strstr(threadName, "Audio") != NULL || strstr(threadName, "OpenAL") != NULL) {
        OptimizeAudioThread();
    } else if (strncmp(threadName, "Worker-Main", 11) == 0 || strncmp(threadName, "ForkJoinPool", 12) == 0) {
        OptimizeWorkerThread();
    }
}

static void JNICALL OnThreadStart(jvmtiEnv *jvmti_env, JNIEnv *jni_env, jthread thread) {
    UNREFERENCED_PARAMETER(jni_env);

    if (!g_optThreads) return;

    jvmtiThreadInfo info;
    memset(&info, 0, sizeof(info));
    if ((*jvmti_env)->GetThreadInfo(jvmti_env, thread, &info) == JVMTI_ERROR_NONE) {
        if (info.name != NULL) {
            OptimizeThreadByName(info.name);
            (*jvmti_env)->Deallocate(jvmti_env, (unsigned char *)info.name);
        }
    }
}

static void JNICALL OnVMInit(jvmtiEnv *jvmti_env, JNIEnv *jni_env, jthread thread) {
    UNREFERENCED_PARAMETER(jvmti_env);
    UNREFERENCED_PARAMETER(jni_env);
    UNREFERENCED_PARAMETER(thread);

    if (!g_optThreads) return;

    // En VMInit el hilo principal todavia se llama "main" y JVMTI no avisa del renombre a "Render thread".
    OptimizeRenderThread();
}

// ============================================================================
// 5. OPTIMIZACIONES GLOBALES DE PROCESO (Anti-Ghosting & WDDM GPU Priority)
// ============================================================================
static void DisableWindowGhosting(void) {
    HMODULE hUser32 = GetModuleHandleW(L"user32.dll");
    if (hUser32 != NULL) {
        typedef void (WINAPI *pfnDisableProcessWindowsGhosting)(void);
        pfnDisableProcessWindowsGhosting pDisable = 
            (pfnDisableProcessWindowsGhosting)GetProcAddress(hUser32, "DisableProcessWindowsGhosting");
        if (pDisable != NULL) {
            pDisable();
        }
    }
}

static void ElevateGpuPriority(void) {
    HMODULE hGdi32 = GetModuleHandleW(L"gdi32.dll");
    if (hGdi32 == NULL) {
        hGdi32 = LoadLibraryW(L"gdi32.dll");
    }
    if (hGdi32 != NULL) {
        typedef LONG (APIENTRY *pfnD3DKMTSetProcessSchedulingPriorityClass)(HANDLE, UINT);
        pfnD3DKMTSetProcessSchedulingPriorityClass pfnD3DKMT = 
            (pfnD3DKMTSetProcessSchedulingPriorityClass)GetProcAddress(hGdi32, "D3DKMTSetProcessSchedulingPriorityClass");
        if (pfnD3DKMT != NULL) {
            // 4 = D3DKMT_SCHEDULINGPRIORITYCLASS_HIGH en el planificador WDDM
            LONG status = pfnD3DKMT(GetCurrentProcess(), 4);
            if (status != 0) {
                LogLine("[ct-agent] Advertencia: D3DKMTSetProcessSchedulingPriorityClass(HIGH) fallo con codigo 0x%08X", (unsigned int)status);
            }
        } else {
            LogLine("[ct-agent] Advertencia: D3DKMTSetProcessSchedulingPriorityClass no encontrada en gdi32.dll");
        }
    } else {
        LogLine("[ct-agent] Advertencia: gdi32.dll no disponible");
    }
}

// ============================================================================
// 6. CICLO DE VIDA DEL AGENTE JVMTI
// ============================================================================
JNIEXPORT jint JNICALL Agent_OnLoad(JavaVM *vm, char *options, void *reserved) {
    UNREFERENCED_PARAMETER(reserved);

    // 1. Procesar opciones
    ParseOptions(options);

    // 2. Optimizaciones de proceso independientes de JVMTI
    DisableWindowGhosting();

    if (g_optGpu) {
        ElevateGpuPriority();
    }

    // 3. Conectar entorno JVMTI
    jvmtiEnv *jvmti = NULL;
    jint res = (*vm)->GetEnv(vm, (void **)&jvmti, JVMTI_VERSION_1_2);
    int jvmtiHooked = 0;

    if (res == JNI_OK && jvmti != NULL) {
        jvmtiHooked = 1;

        if (g_optThreads) {
            jvmtiEventCallbacks callbacks;
            memset(&callbacks, 0, sizeof(callbacks));
            callbacks.VMInit = &OnVMInit;
            callbacks.ThreadStart = &OnThreadStart;

            (*jvmti)->SetEventCallbacks(jvmti, &callbacks, (jint)sizeof(callbacks));
            (*jvmti)->SetEventNotificationMode(jvmti, JVMTI_ENABLE, JVMTI_EVENT_VM_INIT, (jthread)NULL);
            (*jvmti)->SetEventNotificationMode(jvmti, JVMTI_ENABLE, JVMTI_EVENT_THREAD_START, (jthread)NULL);
        }
    } else {
        LogLine("[ct-agent] Advertencia: GetEnv(JVMTI_VERSION_1_2) fallo con codigo %d", (int)res);
    }

    // 4. Registro de carga en archivo
    LogLine("[ct-agent] Loaded: threads=%s, gpu=%s, jvmti=%s",
            g_optThreads ? "on" : "off",
            g_optGpu ? "high" : "off",
            jvmtiHooked ? "enganchado" : "fallido");

    return JNI_OK;
}

JNIEXPORT void JNICALL Agent_OnUnload(JavaVM *vm) {
    UNREFERENCED_PARAMETER(vm);

    // El descriptor MMCSS se almacena en TLS (__declspec(thread)) y el kernel lo libera al terminar el hilo;
    // llamar a AvRevertMmThreadCharacteristics desde un hilo ajeno de descarga no es valido.
    LogLine("[ct-agent] Unloaded");
}
