/*
 * ct_agent.c - Agente Nativo JVMTI Seguro y Eficiente para Minecraft (CrystalTides)
 *
 * Características:
 * 1. Clasificación Jerárquica de Hilos en Kernel (Render, Server, Netty, Audio, Workers) con MMCSS y bypass de EcoQoS.
 * 2. Topología Híbrida de CPU Sets (GetSystemCpuSetInformation / SetThreadSelectedCpuSets) para aislamiento P-Cores / E-Cores y L3 CCD.
 * 3. Resolución de Temporizador de Kernel a 0.5 ms vía NtSetTimerResolution(5000).
 * 4. Supresión de Ventana "(No Responde)" vía DisableProcessWindowsGhosting.
 * 5. Prioridad de GPU REALTIME (5) con fallback automático a HIGH (4) en el planificador WDDM vía D3DKMTSetProcessSchedulingPriorityClass.
 * 6. Configuración flexible mediante opciones de agente y variables de entorno (threads, gpu, timer, cpusets).
 * 7. Registro atómico y seguro de ciclo de vida en ct-agent.log.
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
static int g_optGpu = 2;     // 2 = realtime (defecto), 1 = high, 0 = off
static int g_optTimer = 1;   // 1 = 05ms (defecto), 0 = off
static int g_optCpuSets = 1; // 1 = on (defecto), 0 = off

static void ApplyOptionKeyValue(const char *key, const char *val) {
    if (_stricmp(key, "threads") == 0) {
        if (_stricmp(val, "on") == 0 || _stricmp(val, "1") == 0 || _stricmp(val, "true") == 0) {
            g_optThreads = 1;
        } else if (_stricmp(val, "off") == 0 || _stricmp(val, "0") == 0 || _stricmp(val, "false") == 0) {
            g_optThreads = 0;
        } else {
            LogLine("[ct-agent] Advertencia: valor invalido '%s' para 'threads' (usando defecto 'on')", val);
            g_optThreads = 1;
        }
    } else if (_stricmp(key, "gpu") == 0) {
        if (_stricmp(val, "realtime") == 0 || _stricmp(val, "2") == 0) {
            g_optGpu = 2;
        } else if (_stricmp(val, "high") == 0 || _stricmp(val, "1") == 0) {
            g_optGpu = 1;
        } else if (_stricmp(val, "off") == 0 || _stricmp(val, "0") == 0 || _stricmp(val, "false") == 0) {
            g_optGpu = 0;
        } else {
            LogLine("[ct-agent] Advertencia: valor invalido '%s' para 'gpu' (usando defecto 'realtime')", val);
            g_optGpu = 2;
        }
    } else if (_stricmp(key, "timer") == 0) {
        if (_stricmp(val, "05ms") == 0 || _stricmp(val, "0.5ms") == 0 || _stricmp(val, "on") == 0 || _stricmp(val, "1") == 0 || _stricmp(val, "true") == 0) {
            g_optTimer = 1;
        } else if (_stricmp(val, "off") == 0 || _stricmp(val, "0") == 0 || _stricmp(val, "false") == 0) {
            g_optTimer = 0;
        } else {
            LogLine("[ct-agent] Advertencia: valor invalido '%s' para 'timer' (usando defecto '05ms')", val);
            g_optTimer = 1;
        }
    } else if (_stricmp(key, "cpusets") == 0) {
        if (_stricmp(val, "on") == 0 || _stricmp(val, "1") == 0 || _stricmp(val, "true") == 0) {
            g_optCpuSets = 1;
        } else if (_stricmp(val, "off") == 0 || _stricmp(val, "0") == 0 || _stricmp(val, "false") == 0) {
            g_optCpuSets = 0;
        } else {
            LogLine("[ct-agent] Advertencia: valor invalido '%s' para 'cpusets' (usando defecto 'on')", val);
            g_optCpuSets = 1;
        }
    } else {
        LogLine("[ct-agent] Advertencia: opcion desconocida '%s=%s' (ignorada)", key, val);
    }
}

static void CheckEnvOverride(const char *envName, const char *optKey) {
    char envVal[64];
    DWORD n = GetEnvironmentVariableA(envName, envVal, sizeof(envVal));
    if (n > 0 && n < sizeof(envVal)) {
        ApplyOptionKeyValue(optKey, envVal);
    }
}

static void ParseOptions(const char *options) {
    if (options != NULL && *options != '\0') {
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
                ApplyOptionKeyValue(key, val);
            }
            token = strtok_s(NULL, ",", &next_token);
        }
    }

    CheckEnvOverride("CT_AGENT_THREADS", "threads");
    CheckEnvOverride("CT_AGENT_GPU", "gpu");
    CheckEnvOverride("CT_AGENT_TIMER", "timer");
    CheckEnvOverride("CT_AGENT_CPUSETS", "cpusets");
}

// ============================================================================
// 3. BYPASS DE WINDOWS 11 EcoQoS & TOPOLOGÍA HÍBRIDA DE CPU SETS
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

typedef struct _CT_SYSTEM_CPU_SET_INFORMATION {
    DWORD Size;
    int Type;
    DWORD Id;
    WORD Group;
    BYTE LogicalProcessorIndex;
    BYTE CoreIndex;
    BYTE LastLevelCacheIndex;
    BYTE NumaNodeIndex;
    BYTE EfficiencyClass;
    BYTE AllFlags;
    DWORD Reserved;
    DWORD64 AllocationTag;
} CT_SYSTEM_CPU_SET_INFORMATION;

typedef BOOL (WINAPI *pfnGetSystemCpuSetInformation)(
    CT_SYSTEM_CPU_SET_INFORMATION *Information,
    ULONG BufferLength,
    PULONG ReturnedLength,
    HANDLE Process,
    ULONG Flags
);

typedef BOOL (WINAPI *pfnSetThreadSelectedCpuSets)(
    HANDLE Thread,
    const ULONG *CpuSetIds,
    ULONG CpuSetIdCount
);

#define MAX_CT_CPU_SETS 64
static ULONG g_pCoreCpuSetIds[MAX_CT_CPU_SETS];
static ULONG g_pCoreCount = 0;
static ULONG g_eCoreCpuSetIds[MAX_CT_CPU_SETS];
static ULONG g_eCoreCount = 0;
static pfnSetThreadSelectedCpuSets g_pfnSetThreadSelectedCpuSets = NULL;

static void InitCpuSetsTopology(void) {
    g_pCoreCount = 0;
    g_eCoreCount = 0;
    g_pfnSetThreadSelectedCpuSets = NULL;

    if (!g_optCpuSets) {
        return;
    }

    HMODULE hKernel32 = GetModuleHandleW(L"kernel32.dll");
    if (hKernel32 == NULL) {
        return;
    }

    pfnGetSystemCpuSetInformation pGetSystemCpuSetInformation =
        (pfnGetSystemCpuSetInformation)GetProcAddress(hKernel32, "GetSystemCpuSetInformation");
    g_pfnSetThreadSelectedCpuSets =
        (pfnSetThreadSelectedCpuSets)GetProcAddress(hKernel32, "SetThreadSelectedCpuSets");

    if (pGetSystemCpuSetInformation == NULL || g_pfnSetThreadSelectedCpuSets == NULL) {
        LogLine("[ct-agent] Advertencia: APIs de CPU Sets no disponibles en kernel32.dll");
        return;
    }

    BYTE rawBuf[8192];
    ULONG returnedLen = 0;
    if (!pGetSystemCpuSetInformation((CT_SYSTEM_CPU_SET_INFORMATION *)rawBuf, sizeof(rawBuf), &returnedLen, GetCurrentProcess(), 0) || returnedLen == 0) {
        LogLine("[ct-agent] Advertencia: GetSystemCpuSetInformation fallo o devolvio 0 bytes");
        return;
    }

    BYTE minEff = 0xFF;
    BYTE maxEff = 0;
    ULONG totalSets = 0;

    ULONG offset = 0;
    while (offset + sizeof(CT_SYSTEM_CPU_SET_INFORMATION) <= returnedLen) {
        CT_SYSTEM_CPU_SET_INFORMATION *entry = (CT_SYSTEM_CPU_SET_INFORMATION *)(rawBuf + offset);
        if (entry->Size == 0) break;
        if (entry->Type == 0) {
            if (entry->EfficiencyClass < minEff) minEff = entry->EfficiencyClass;
            if (entry->EfficiencyClass > maxEff) maxEff = entry->EfficiencyClass;
            totalSets++;
        }
        offset += entry->Size;
    }

    if (totalSets == 0) {
        return;
    }

    BYTE minLlc = 0xFF;
    BYTE maxLlc = 0;
    offset = 0;
    while (offset + sizeof(CT_SYSTEM_CPU_SET_INFORMATION) <= returnedLen) {
        CT_SYSTEM_CPU_SET_INFORMATION *entry = (CT_SYSTEM_CPU_SET_INFORMATION *)(rawBuf + offset);
        if (entry->Size == 0) break;
        if (entry->Type == 0 && entry->EfficiencyClass == maxEff) {
            if (entry->LastLevelCacheIndex < minLlc) minLlc = entry->LastLevelCacheIndex;
            if (entry->LastLevelCacheIndex > maxLlc) maxLlc = entry->LastLevelCacheIndex;
        }
        offset += entry->Size;
    }

    int isHybridOrMultiCcd = (maxEff > minEff) || (maxLlc > minLlc);

    ULONG primaryPhysicalIds[MAX_CT_CPU_SETS];
    ULONG primaryPhysicalCount = 0;
    ULONG primaryAllIds[MAX_CT_CPU_SETS];
    ULONG primaryAllCount = 0;

    WORD seenGroups[MAX_CT_CPU_SETS];
    BYTE seenCores[MAX_CT_CPU_SETS];
    ULONG seenPhysicalCount = 0;

    offset = 0;
    while (offset + sizeof(CT_SYSTEM_CPU_SET_INFORMATION) <= returnedLen) {
        CT_SYSTEM_CPU_SET_INFORMATION *entry = (CT_SYSTEM_CPU_SET_INFORMATION *)(rawBuf + offset);
        if (entry->Size == 0) break;
        if (entry->Type == 0) {
            if (entry->EfficiencyClass == maxEff && entry->LastLevelCacheIndex == minLlc) {
                if (primaryAllCount < MAX_CT_CPU_SETS) {
                    primaryAllIds[primaryAllCount++] = entry->Id;
                }

                int alreadySeenCore = 0;
                for (ULONG i = 0; i < seenPhysicalCount; i++) {
                    if (seenGroups[i] == entry->Group && seenCores[i] == entry->CoreIndex) {
                        alreadySeenCore = 1;
                        break;
                    }
                }
                if (!alreadySeenCore && seenPhysicalCount < MAX_CT_CPU_SETS) {
                    seenGroups[seenPhysicalCount] = entry->Group;
                    seenCores[seenPhysicalCount] = entry->CoreIndex;
                    seenPhysicalCount++;
                    if (primaryPhysicalCount < MAX_CT_CPU_SETS) {
                        primaryPhysicalIds[primaryPhysicalCount++] = entry->Id;
                    }
                }
            } else if (isHybridOrMultiCcd) {
                if (g_eCoreCount < MAX_CT_CPU_SETS) {
                    g_eCoreCpuSetIds[g_eCoreCount++] = entry->Id;
                }
            }
        }
        offset += entry->Size;
    }

    if (primaryPhysicalCount >= 2 && (isHybridOrMultiCcd || primaryAllCount > primaryPhysicalCount)) {
        for (ULONG i = 0; i < primaryPhysicalCount; i++) {
            g_pCoreCpuSetIds[i] = primaryPhysicalIds[i];
        }
        g_pCoreCount = primaryPhysicalCount;
    } else if (isHybridOrMultiCcd && primaryAllCount > 0) {
        for (ULONG i = 0; i < primaryAllCount; i++) {
            g_pCoreCpuSetIds[i] = primaryAllIds[i];
        }
        g_pCoreCount = primaryAllCount;
    }

    LogLine("[ct-agent] CpuSets topologia: total=%lu, p_sets=%lu, e_sets=%lu (eff=%u..%u, llc=%u..%u)",
            totalSets,
            g_pCoreCount,
            g_eCoreCount,
            (unsigned int)minEff,
            (unsigned int)maxEff,
            (unsigned int)minLlc,
            (unsigned int)maxLlc);
}

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
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST);
    DisableEcoQoSOnCurrentThread();
    if (g_optCpuSets && g_pCoreCount > 0 && g_pfnSetThreadSelectedCpuSets != NULL) {
        g_pfnSetThreadSelectedCpuSets(GetCurrentThread(), g_pCoreCpuSetIds, g_pCoreCount);
    }
}

static void OptimizeServerThread(void) {
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
    DisableEcoQoSOnCurrentThread();
    if (g_optCpuSets && g_pCoreCount > 0 && g_pfnSetThreadSelectedCpuSets != NULL) {
        g_pfnSetThreadSelectedCpuSets(GetCurrentThread(), g_pCoreCpuSetIds, g_pCoreCount);
    }
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
    if (g_optCpuSets && g_eCoreCount > 0 && g_pfnSetThreadSelectedCpuSets != NULL) {
        g_pfnSetThreadSelectedCpuSets(GetCurrentThread(), g_eCoreCpuSetIds, g_eCoreCount);
    }
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
// 5. OPTIMIZACIONES GLOBALES DE PROCESO (Anti-Ghosting, Timer 0.5ms & WDDM GPU)
// ============================================================================
static int g_timerResolutionActive = 0;

static void ApplyKernelTimerResolution(BOOLEAN enable) {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (hNtdll == NULL) {
        return;
    }
    typedef LONG (NTAPI *pfnNtSetTimerResolution)(ULONG DesiredResolution, BOOLEAN SetResolution, PULONG CurrentResolution);
    pfnNtSetTimerResolution pNtSetTimerResolution =
        (pfnNtSetTimerResolution)GetProcAddress(hNtdll, "NtSetTimerResolution");
    if (pNtSetTimerResolution == NULL) {
        if (enable) {
            LogLine("[ct-agent] Advertencia: NtSetTimerResolution no encontrada en ntdll.dll");
        }
        return;
    }

    ULONG actualRes = 0;
    LONG status = pNtSetTimerResolution(5000, enable, &actualRes);
    if (enable) {
        if (status == 0) {
            g_timerResolutionActive = 1;
            LogLine("[ct-agent] NtSetTimerResolution(0.5ms) aplicado (actual=%lu units de 100ns)", actualRes);
        } else {
            LogLine("[ct-agent] Advertencia: NtSetTimerResolution(5000) fallo con codigo 0x%08X", (unsigned int)status);
        }
    } else {
        g_timerResolutionActive = 0;
    }
}

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
            if (g_optGpu == 2) {
                // 5 = D3DKMT_SCHEDULINGPRIORITYCLASS_REALTIME en el planificador WDDM
                LONG status = pfnD3DKMT(GetCurrentProcess(), 5);
                if (status == 0) {
                    LogLine("[ct-agent] D3DKMTSetProcessSchedulingPriorityClass(REALTIME) aplicado con exito");
                } else {
                    // Fallback inmediato a 4 = D3DKMT_SCHEDULINGPRIORITYCLASS_HIGH (ej. 0xC0000061 STATUS_PRIVILEGE_NOT_HELD)
                    LONG fallbackStatus = pfnD3DKMT(GetCurrentProcess(), 4);
                    if (fallbackStatus == 0) {
                        LogLine("[ct-agent] D3DKMTSetProcessSchedulingPriorityClass(REALTIME) devolvio 0x%08X; fallback a HIGH aplicado con exito", (unsigned int)status);
                    } else {
                        LogLine("[ct-agent] Advertencia: D3DKMTSetProcessSchedulingPriorityClass(REALTIME=0x%08X, HIGH=0x%08X) fallo", (unsigned int)status, (unsigned int)fallbackStatus);
                    }
                }
            } else if (g_optGpu == 1) {
                // 4 = D3DKMT_SCHEDULINGPRIORITYCLASS_HIGH en el planificador WDDM
                LONG status = pfnD3DKMT(GetCurrentProcess(), 4);
                if (status == 0) {
                    LogLine("[ct-agent] D3DKMTSetProcessSchedulingPriorityClass(HIGH) aplicado con exito");
                } else {
                    LogLine("[ct-agent] Advertencia: D3DKMTSetProcessSchedulingPriorityClass(HIGH) fallo con codigo 0x%08X", (unsigned int)status);
                }
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

    // 1. Procesar opciones y variables de entorno
    ParseOptions(options);

    // 2. Optimizaciones de proceso independientes de JVMTI
    DisableWindowGhosting();

    if (g_optTimer) {
        ApplyKernelTimerResolution(TRUE);
    }

    if (g_optGpu) {
        ElevateGpuPriority();
    }

    if (g_optCpuSets) {
        InitCpuSetsTopology();
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
    const char *gpuModeStr = (g_optGpu == 2) ? "realtime" : ((g_optGpu == 1) ? "high" : "off");
    LogLine("[ct-agent] Loaded: threads=%s, gpu=%s, timer=%s, cpusets=%s, jvmti=%s",
            g_optThreads ? "on" : "off",
            gpuModeStr,
            g_optTimer ? "05ms" : "off",
            g_optCpuSets ? "on" : "off",
            jvmtiHooked ? "enganchado" : "fallido");

    return JNI_OK;
}

JNIEXPORT void JNICALL Agent_OnUnload(JavaVM *vm) {
    UNREFERENCED_PARAMETER(vm);

    if (g_timerResolutionActive) {
        ApplyKernelTimerResolution(FALSE);
    }

    // El descriptor MMCSS se almacena en TLS (__declspec(thread)) y el kernel lo libera al terminar el hilo;
    // llamar a AvRevertMmThreadCharacteristics desde un hilo ajeno de descarga no es valido.
    LogLine("[ct-agent] Unloaded");
}