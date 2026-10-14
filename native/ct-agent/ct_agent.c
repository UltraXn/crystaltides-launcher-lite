/*
 * ct_agent.c - Agente Nativo JVMTI de Rendimiento Industrial para Minecraft (CrystalTides)
 *
 * Características Implementadas:
 * 1. Clasificación Jerárquica Integral de Hilos en Kernel (Render, Server, Netty, Audio, Workers).
 * 2. Captura Forense de Excepciones Nativas (Vectored Exception Handler - VEH).
 * 3. Medición de Frametime Real en Nanosegundos con QueryPerformanceCounter (QPC).
 * 4. Adquisición Automática de Privilegios de Memoria (SeLockMemoryPrivilege para Large Pages).
 * 5. Purga Proactiva de Memoria Off-Heap (Hooks de mimalloc y Working Set Trim).
 * 6. Forzado de GPU Dedicada por Símbolos Exportados (NVIDIA Optimus & AMD PowerXpress).
 * 7. Temporizador Multimedia Extremo a 0.5 ms vía NtSetTimerResolution.
 * 8. Supresión de Pantalla Blanca "(No Responde)" vía DisableProcessWindowsGhosting.
 * 9. Prioridad de GPU Realtime en WDDM vía D3DKMTSetProcessSchedulingPriorityClass.
 *
 * Compilación recomendada (MSVC):
 *   cl.exe /O2 /MT /LD /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" ct_agent.c /Fe:ct-agent.dll
 */

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <avrt.h>
#include <mmsystem.h>
#include <jvmti.h>
#include <string.h>

#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "user32.lib")

// ============================================================================
// 1. FORZADO DE GPU DEDICADA DE ALTO RENDIMIENTO (NVIDIA Optimus & AMD)
// ============================================================================
__declspec(dllexport) DWORD NvOptimusEnablement = 0x00000001;
__declspec(dllexport) int AmdPowerXpressRequestHighPerformance = 1;

// ============================================================================
// 2. TEMPORIZADOR DE ALTA RESOLUCIÓN A 0.5 MS (NtSetTimerResolution)
// ============================================================================
typedef LONG (NTAPI *pfnNtSetTimerResolution)(ULONG RequestedResolution, BOOLEAN Set, PULONG ActualResolution);

static ULONG g_actualTimerRes = 0;
static BOOLEAN g_timerSet = FALSE;

static void EnableHighResolutionTimer(void) {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (hNtdll != NULL) {
        pfnNtSetTimerResolution pNtSetTimerResolution = 
            (pfnNtSetTimerResolution)GetProcAddress(hNtdll, "NtSetTimerResolution");
        if (pNtSetTimerResolution != NULL) {
            // 5000 * 100ns = 500,000ns = 0.5 ms
            if (pNtSetTimerResolution(5000, TRUE, &g_actualTimerRes) >= 0) {
                g_timerSet = TRUE;
            }
        }
    }
    timeBeginPeriod(1);
}

static void RestoreTimerResolution(void) {
    if (g_timerSet) {
        HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
        if (hNtdll != NULL) {
            pfnNtSetTimerResolution pNtSetTimerResolution = 
                (pfnNtSetTimerResolution)GetProcAddress(hNtdll, "NtSetTimerResolution");
            if (pNtSetTimerResolution != NULL) {
                pNtSetTimerResolution(g_actualTimerRes, FALSE, &g_actualTimerRes);
            }
        }
        g_timerSet = FALSE;
    }
    timeEndPeriod(1);
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
            throttling.StateMask = 0x0;   // 0 = Desactivar limitación de velocidad
            pSetThreadInformation(GetCurrentThread(), 1 /* ThreadPowerThrottling */, &throttling, sizeof(throttling));
        }
    }
}

// ============================================================================
// 4. PRIVILEGIOS DE MEMORIA: SeLockMemoryPrivilege (Large Pages 2MB)
// ============================================================================
static void EnableLargePagesPrivilege(void) {
    HANDLE hToken = NULL;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &hToken)) {
        TOKEN_PRIVILEGES tp;
        memset(&tp, 0, sizeof(tp));
        if (LookupPrivilegeValueW(NULL, L"SeLockMemoryPrivilege", &tp.Privileges[0].Luid)) {
            tp.PrivilegeCount = 1;
            tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
            AdjustTokenPrivileges(hToken, FALSE, &tp, 0, NULL, NULL);
        }
        CloseHandle(hToken);
    }
}

// ============================================================================
// 5. PURGA PROACTIVA DE MEMORIA OFF-HEAP (Hooks de mimalloc & Working Set)
// ============================================================================
typedef void (*pfn_mi_collect)(BOOL force);
static pfn_mi_collect g_pfn_mi_collect = NULL;

static void InitMimallocCollector(void) {
    HMODULE hMimalloc = GetModuleHandleW(L"mimalloc.dll");
    if (hMimalloc == NULL) {
        hMimalloc = GetModuleHandleW(L"mimalloc-override.dll");
    }
    if (hMimalloc != NULL) {
        g_pfn_mi_collect = (pfn_mi_collect)GetProcAddress(hMimalloc, "mi_collect");
    }
}

JNIEXPORT void JNICALL Java_com_crystaltides_agent_CrystalAgent_nativePurgeOffHeapMemory(JNIEnv *env, jclass clazz) {
    UNREFERENCED_PARAMETER(env);
    UNREFERENCED_PARAMETER(clazz);

    // 1. Purgar páginas nativas en mimalloc si está presente
    if (g_pfn_mi_collect != NULL) {
        g_pfn_mi_collect(TRUE);
    }
    // 2. Compactar Working Set para liberar bloques de RAM inactivos
    SetProcessWorkingSetSize(GetCurrentProcess(), (SIZE_T)-1, (SIZE_T)-1);
}

// ============================================================================
// 6. MEDICIÓN DE FRAMETIMES EN NANOSEGUNDOS CON QPC
// ============================================================================
#define QPC_HISTORY_SIZE 128
static LARGE_INTEGER g_qpcFreq = {0};
static LARGE_INTEGER g_lastPresentQpc = {0};
static double g_frametimeHistoryMs[QPC_HISTORY_SIZE] = {0};
static volatile LONG g_frametimeIndex = 0;
static double g_latestP99FrametimeMs = 0.0;
static double g_latestAvgFrametimeMs = 0.0;

static void InitQpcTimer(void) {
    QueryPerformanceFrequency(&g_qpcFreq);
    QueryPerformanceCounter(&g_lastPresentQpc);
}

__declspec(dllexport) void CT_RecordFramePresent(void) {
    if (g_qpcFreq.QuadPart == 0) return;

    LARGE_INTEGER now;
    QueryPerformanceCounter(&now);

    LONGLONG diff = now.QuadPart - g_lastPresentQpc.QuadPart;
    g_lastPresentQpc = now;

    double frameMs = (double)diff * 1000.0 / (double)g_qpcFreq.QuadPart;
    if (frameMs > 0.0 && frameMs < 500.0) {
        LONG idx = InterlockedIncrement(&g_frametimeIndex) % QPC_HISTORY_SIZE;
        g_frametimeHistoryMs[idx] = frameMs;

        // Cada 64 fotogramas calcular promedio y p99
        if (idx % 64 == 0) {
            double sum = 0.0;
            double maxFrame = 0.0;
            for (int i = 0; i < QPC_HISTORY_SIZE; i++) {
                double val = g_frametimeHistoryMs[i];
                sum += val;
                if (val > maxFrame) maxFrame = val;
            }
            g_latestAvgFrametimeMs = sum / QPC_HISTORY_SIZE;
            g_latestP99FrametimeMs = maxFrame; // Estimación de pico p99
        }
    }
}

__declspec(dllexport) double CT_GetP99FrametimeMs(void) {
    return g_latestP99FrametimeMs;
}

__declspec(dllexport) double CT_GetAvgFrametimeMs(void) {
    return g_latestAvgFrametimeMs;
}

// ============================================================================
// 7. MANEJO FORENSE DE EXCEPCIONES NATIVAS (Vectored Exception Handler)
// ============================================================================
static PVOID g_vehHandle = NULL;

static LONG WINAPI VectoredCrashHandler(PEXCEPTION_POINTERS pExceptionInfo) {
    DWORD code = pExceptionInfo->ExceptionRecord->ExceptionCode;
    
    // Capturar Access Violation (0xC0000005) o Illegal Instruction (0xC000001D)
    if (code == EXCEPTION_ACCESS_VIOLATION || code == EXCEPTION_ILLEGAL_INSTRUCTION) {
        PVOID faultAddr = pExceptionInfo->ExceptionRecord->ExceptionAddress;
        HMODULE hFaultModule = NULL;

        WCHAR modPath[MAX_PATH];
        modPath[0] = L'\0';

        if (GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                               (LPCWSTR)faultAddr, &hFaultModule)) {
            GetModuleFileNameW(hFaultModule, modPath, MAX_PATH);
        }

        WCHAR debugMsg[512];
        wsprintfW(debugMsg, L"[CT_AGENT_CRASH] Exception 0x%08X en direccion %p (Modulo: %ls)\n", 
                  code, faultAddr, modPath[0] ? modPath : L"Desconocido");
        OutputDebugStringW(debugMsg);
    }

    // Permitir que la cadena de excepciones continúe su curso habitual
    return EXCEPTION_CONTINUE_SEARCH;
}

// ============================================================================
// 8. JERARQUÍA COMPLETA DE HILOS DE MINECRAFT
// ============================================================================
static HANDLE g_renderMmcssHandle = NULL;
static HANDLE g_serverMmcssHandle = NULL;
static HANDLE g_audioMmcssHandle = NULL;
static jvmtiEnv *g_jvmti = NULL;

static void OptimizeThreadByName(const char *threadName) {
    if (threadName == NULL) return;

    DWORD taskIndex = 0;

    // 1. HILO DE RENDER / CLIENTE (Máxima prioridad de CPU y GPU)
    if (strcmp(threadName, "Render thread") == 0 || strcmp(threadName, "Client thread") == 0) {
        HANDLE hMmcss = AvSetMmThreadCharacteristicsW(L"Games", &taskIndex);
        if (hMmcss != NULL) {
            AvSetMmThreadPriority(hMmcss, AVRT_PRIORITY_HIGH);
            g_renderMmcssHandle = hMmcss;
        }
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
        DisableEcoQoSOnCurrentThread();
    }
    // 2. HILO DEL SERVIDOR INTEGRADO (Lógica del mundo, ticks de bloques y mobs)
    else if (strcmp(threadName, "Server thread") == 0) {
        HANDLE hMmcss = AvSetMmThreadCharacteristicsW(L"Games", &taskIndex);
        if (hMmcss != NULL) {
            AvSetMmThreadPriority(hMmcss, AVRT_PRIORITY_NORMAL);
            g_serverMmcssHandle = hMmcss;
        }
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
        DisableEcoQoSOnCurrentThread();
    }
    // 3. HILOS DE RED NETTY (Procesamiento de paquetes multijugador)
    else if (strncmp(threadName, "Netty", 5) == 0) {
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
        DisableEcoQoSOnCurrentThread();
    }
    // 4. HILO DE AUDIO (OpenAL Soft)
    else if (strstr(threadName, "Audio") != NULL || strstr(threadName, "OpenAL") != NULL) {
        HANDLE hMmcss = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);
        if (hMmcss != NULL) {
            AvSetMmThreadPriority(hMmcss, AVRT_PRIORITY_NORMAL);
            g_audioMmcssHandle = hMmcss;
        }
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
    }
    // 5. WORKER THREADS (Meshing de chunks de Sodium / Tareas secundarias)
    else if (strncmp(threadName, "Worker-Main", 11) == 0 || strncmp(threadName, "ForkJoinPool", 12) == 0) {
        // Degradar ligeramente para que no le roben ciclos de CPU ni calor al Render Thread
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    }
}

static void JNICALL OnThreadStart(jvmtiEnv *jvmti_env, JNIEnv *jni_env, jthread thread) {
    UNREFERENCED_PARAMETER(jni_env);

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

    // Optimizar el hilo de arranque inicial
    OptimizeThreadByName("Render thread");
}

// ============================================================================
// 9. OPTIMIZACIONES GLOBALES DE PROCESO (Anti-Ghosting & WDDM GPU Priority)
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
    if (hGdi32 != NULL) {
        typedef LONG (APIENTRY *pfnD3DKMTSetProcessSchedulingPriorityClass)(HANDLE, UINT);
        pfnD3DKMTSetProcessSchedulingPriorityClass pfnD3DKMT = 
            (pfnD3DKMTSetProcessSchedulingPriorityClass)GetProcAddress(hGdi32, "D3DKMTSetProcessSchedulingPriorityClass");
        if (pfnD3DKMT != NULL) {
            // 5 = D3DKMT_SCHEDULINGPRIORITYCLASS_REALTIME en el planificador WDDM
            pfnD3DKMT(GetCurrentProcess(), 5);
        }
    }
}

// ============================================================================
// 10. CICLO DE VIDA DEL AGENTE JVMTI
// ============================================================================
JNIEXPORT jint JNICALL Agent_OnLoad(JavaVM *vm, char *options, void *reserved) {
    UNREFERENCED_PARAMETER(options);
    UNREFERENCED_PARAMETER(reserved);

    // 1. Temporizador de precisión de 0.5 ms
    EnableHighResolutionTimer();

    // 2. Prevenir pantallas blancas de Windows "(No responde)"
    DisableWindowGhosting();

    // 3. Asignar prioridad de hardware REALTIME en la GPU
    ElevateGpuPriority();

    // 4. Desbloquear Large Pages (SeLockMemoryPrivilege)
    EnableLargePagesPrivilege();

    // 5. Inicializar cronómetro de alta resolución QPC
    InitQpcTimer();

    // 6. Conectar recolector de purga mimalloc si está presente
    InitMimallocCollector();

    // 7. Instalar manejador forense de excepciones nativas (VEH)
    g_vehHandle = AddVectoredExceptionHandler(1, VectoredCrashHandler);

    // 8. Obtener entorno JVMTI
    jint res = (*vm)->GetEnv(vm, (void **)&g_jvmti, JVMTI_VERSION_1_2);
    if (res != JNI_OK || g_jvmti == NULL) {
        return JNI_OK;
    }

    // 9. Suscribirse a eventos de inicialización y ciclo de hilos
    jvmtiEventCallbacks callbacks;
    memset(&callbacks, 0, sizeof(callbacks));
    callbacks.VMInit = &OnVMInit;
    callbacks.ThreadStart = &OnThreadStart;

    (*g_jvmti)->SetEventCallbacks(g_jvmti, &callbacks, (jint)sizeof(callbacks));
    (*g_jvmti)->SetEventNotificationMode(g_jvmti, JVMTI_ENABLE, JVMTI_EVENT_VM_INIT, (jthread)NULL);
    (*g_jvmti)->SetEventNotificationMode(g_jvmti, JVMTI_ENABLE, JVMTI_EVENT_THREAD_START, (jthread)NULL);

    return JNI_OK;
}

JNIEXPORT void JNICALL Agent_OnUnload(JavaVM *vm) {
    UNREFERENCED_PARAMETER(vm);

    // Desinstalar VEH
    if (g_vehHandle != NULL) {
        RemoveVectoredExceptionHandler(g_vehHandle);
        g_vehHandle = NULL;
    }

    // Revertir descriptores MMCSS
    if (g_renderMmcssHandle != NULL) {
        AvRevertMmThreadCharacteristics(g_renderMmcssHandle);
        g_renderMmcssHandle = NULL;
    }
    if (g_serverMmcssHandle != NULL) {
        AvRevertMmThreadCharacteristics(g_serverMmcssHandle);
        g_serverMmcssHandle = NULL;
    }
    if (g_audioMmcssHandle != NULL) {
        AvRevertMmThreadCharacteristics(g_audioMmcssHandle);
        g_audioMmcssHandle = NULL;
    }

    // Restaurar temporizador del kernel
    RestoreTimerResolution();
}
