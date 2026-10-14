@echo off
setlocal

echo [CT-AGENT] Compilador de Agente Nativo C para Minecraft...

:: 1. Detectar JAVA_HOME o directorios estandar de JDK
if defined JAVA_HOME goto check_java_inc

if exist "C:\Program Files\Java\jdk-21" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-21"
    goto check_java_inc
)

for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do (
    set "JAVA_HOME=%%d"
    goto check_java_inc
)

for /d %%d in ("C:\Program Files\Microsoft\jdk-21*") do (
    set "JAVA_HOME=%%d"
    goto check_java_inc
)

echo [ERROR] No se encontro JAVA_HOME ni un JDK 21 instalado en rutas estandar.
echo Defina la variable de entorno JAVA_HOME apuntando a su instalacion de JDK.
exit /b 1

:check_java_inc
set "JAVA_INC=%JAVA_HOME%\include"
set "JAVA_WIN32=%JAVA_HOME%\include\win32"

if not exist "%JAVA_INC%\jvmti.h" (
    echo [ERROR] No se encontro jvmti.h en "%JAVA_INC%". Asegurese de que apunta a un JDK y no a un JRE.
    exit /b 1
)

echo [+] JDK detectado en: %JAVA_HOME%

:: 2. Inicializar entorno MSVC si cl.exe no esta en el PATH
where cl >nul 2>nul
if %ERRORLEVEL% equ 0 goto compile_msvc

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
    for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
        set "VS_DIR=%%i"
    )
)

if defined VS_DIR (
    if exist "%VS_DIR%\VC\Auxiliary\Build\vcvars64.bat" (
        echo [INFO] Configurando entorno de 64-bit de MSVC...
        call "%VS_DIR%\VC\Auxiliary\Build\vcvars64.bat" >nul
    )
)

where cl >nul 2>nul
if %ERRORLEVEL% equ 0 goto compile_msvc

:: 3. Intentar con Clang
where clang >nul 2>nul
if %ERRORLEVEL% equ 0 goto compile_clang

echo [ERROR] No se encontro ni MSVC (cl.exe) ni Clang en el sistema.
exit /b 1

:compile_msvc
echo [INFO] Compilando con MSVC (cl.exe) en modo ultra-optimizado (/O2 /MT /LD)...
cl.exe /nologo /O2 /Oi /Ot /MT /LD /DWIN32_LEAN_AND_MEAN /D_AMD64_ ^
       /I"%JAVA_INC%" /I"%JAVA_WIN32%" ^
       ct_agent.c ^
       /link /OPT:REF /OPT:ICF /NODEFAULTLIB:msvcrt.lib /RELEASE ^
       avrt.lib winmm.lib advapi32.lib user32.lib ^
       /OUT:ct-agent.dll

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo la compilacion con MSVC.
    exit /b 1
)

if exist ct_agent.obj del ct_agent.obj
if exist ct-agent.exp del ct-agent.exp
if exist ct-agent.lib del ct-agent.lib

echo [EXITO] ct-agent.dll compilado correctamente con enlace estatico (/MT).
exit /b 0

:compile_clang
echo [INFO] Compilando con Clang...
clang -O3 -shared -DWIN32_LEAN_AND_MEAN -D_AMD64_ ^
      -I"%JAVA_INC%" -I"%JAVA_WIN32%" ^
      ct_agent.c -lavrt -lwinmm -o ct-agent.dll

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo la compilacion con Clang.
    exit /b 1
)

echo [EXITO] ct-agent.dll compilado correctamente con Clang.
exit /b 0
