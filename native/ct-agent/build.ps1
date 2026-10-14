# build.ps1 - Compilador PowerShell para ct-agent.dll
[CmdletBinding()]
param(
    [string]$JdkPath = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CrystalTides Native Agent (ct-agent.dll) Build Tool    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolver JDK Path
if (-not $JdkPath) {
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\include\jvmti.h")) {
        $JdkPath = $env:JAVA_HOME
    } else {
        $candidates = @(
            "C:\Program Files\Java\jdk-21",
            "C:\Program Files\Eclipse Adoptium\jdk-21*",
            "C:\Program Files\Microsoft\jdk-21*"
        )
        foreach ($c in $candidates) {
            $found = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found -and (Test-Path "$($found.FullName)\include\jvmti.h")) {
                $JdkPath = $found.FullName
                break
            }
        }
    }
}

if (-not $JdkPath -or -not (Test-Path "$JdkPath\include\jvmti.h")) {
    Write-Error "No se encontro un JDK 21 con jvmti.h. Especifique -JdkPath o configure JAVA_HOME."
    exit 1
}

Write-Host "[+] JDK detectado: $JdkPath" -ForegroundColor Green
$incMain = Join-Path $JdkPath "include"
$incWin32 = Join-Path $incMain "win32"

# 2. Detectar Compilador MSVC o Clang
$clCmd = Get-Command cl.exe -ErrorAction SilentlyContinue
$clangCmd = Get-Command clang.exe -ErrorAction SilentlyContinue

$outputDll = Join-Path $PSScriptRoot "ct-agent.dll"
$srcFile = Join-Path $PSScriptRoot "ct_agent.c"

if ($clCmd) {
    Write-Host "[+] Compilando con MSVC (cl.exe) /O2 /MT /LD..." -ForegroundColor Yellow
    $clArgs = @(
        "/nologo", "/O2", "/Oi", "/Ot", "/MT", "/LD",
        "/DWIN32_LEAN_AND_MEAN", "/D_AMD64_",
        "-I$incMain", "-I$incWin32",
        $srcFile,
        "/link", "/OPT:REF", "/OPT:ICF", "/NODEFAULTLIB:msvcrt.lib", "/RELEASE",
        "avrt.lib", "winmm.lib", "advapi32.lib", "user32.lib",
        "/OUT:$outputDll"
    )
    & cl.exe $clArgs
    if ($LASTEXITCODE -eq 0) {
        Remove-Item "$PSScriptRoot\ct_agent.obj", "$PSScriptRoot\ct-agent.exp", "$PSScriptRoot\ct-agent.lib" -Force -ErrorAction SilentlyContinue
        $size = (Get-Item $outputDll).Length / 1KB
        Write-Host "[SUCCESS] ct-agent.dll generado con exito ($([Math]::Round($size, 2)) KB)" -ForegroundColor Green
        exit 0
    } else {
        Write-Error "Fallo la compilacion con MSVC."
        exit 1
    }
} elseif ($clangCmd) {
    Write-Host "[+] Compilando con Clang -O3 -shared..." -ForegroundColor Yellow
    $clangArgs = @(
        "-O3", "-shared",
        "-DWIN32_LEAN_AND_MEAN", "-D_AMD64_",
        "-I$incMain", "-I$incWin32",
        $srcFile,
        "-lavrt", "-lwinmm", "-ladvapi32", "-luser32",
        "-o", $outputDll
    )
    & clang.exe $clangArgs
    if ($LASTEXITCODE -eq 0) {
        $size = (Get-Item $outputDll).Length / 1KB
        Write-Host "[SUCCESS] ct-agent.dll generado con exito ($([Math]::Round($size, 2)) KB)" -ForegroundColor Green
        exit 0
    } else {
        Write-Error "Fallo la compilacion con Clang."
        exit 1
    }
} else {
    Write-Host "[!] Buscando instalacion de Visual Studio mediante vswhere..." -ForegroundColor Yellow
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
        $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        $vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
        if (Test-Path $vcvars) {
            Write-Host "[+] Entorno de compilacion encontrado en: $vcvars" -ForegroundColor Green
            Write-Host "Ejecute 'cmd /c build.bat' para compilar con el entorno de Visual Studio cargado." -ForegroundColor Yellow
            & cmd.exe /c "call `"$vcvars`" >nul && cd /d `"$PSScriptRoot`" && build.bat"
            exit $LASTEXITCODE
        }
    }
    Write-Error "No se encontro MSVC ni Clang en el entorno."
    exit 1
}
