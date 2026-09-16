import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLauncherStore, launcherActions, LauncherState } from "./store/launcherStore";
import { WallpaperBackground } from "./components/WallpaperBackground";
import { WindowHeader } from "./components/WindowHeader";
import { BottomBar } from "./components/BottomBar";
import { HomeDock } from "./components/HomeDock";
import { LoginView } from "./components/LoginView";
import { SettingsModal } from "./components/modals/SettingsModal";
import { AccountsModal } from "./components/modals/AccountsModal";
import { AboutModal } from "./components/modals/AboutModal";
import { CrashReportModal } from "./components/modals/CrashReportModal";
import { InstallerView } from "./components/installer/InstallerView";
import { UninstallerView } from "./components/uninstaller/UninstallerView";

interface BootContext {
  mode: "install" | "launcher" | "uninstall";
  defaultInstallDir: string;
  currentExe: string;
  isInstalled: boolean;
  os: string;
}

export const App: React.FC = () => {
  const [bootContext, setBootContext] = useState<BootContext | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [crashModalOpen, setCrashModalOpen] = useState(false);
  const [crashData] = useState<{ reason: string; details: string; code: number }>({
    reason: "Incompatibilidad de mods o fallo de memoria de Java",
    details: "java.lang.OutOfMemoryError: Java heap space",
    code: 1,
  });

  const currentView = useLauncherStore((s: LauncherState) => s.currentView);
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);

  // 1. Detección inicial de modo (Bootstrapping)
  useEffect(() => {
    const initBoot = async () => {
      try {
        const ctx = await invoke<BootContext>("get_boot_context");
        setBootContext(ctx);
      } catch (e) {
        console.warn("Could not retrieve boot context, defaulting to launcher:", e);
        setBootContext({
          mode: "launcher",
          defaultInstallDir: "C:/.crystaltides",
          currentExe: "",
          isInstalled: true,
          os: "windows",
        });
      } finally {
        setBootLoading(false);
      }
    };
    initBoot();
  }, []);

  // 2. Cargar cuentas y listeners solo en modo Launcher
  useEffect(() => {
    if (bootContext?.mode === "launcher") {
      launcherActions.loadAccountsFromVault();
      launcherActions.setupTauriListeners();
    }
  }, [bootContext?.mode]);

  // 3. Listener global de teclado (Escape cierra modales)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal !== "none") {
        launcherActions.closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  if (bootLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#0A090E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#2DD4BF",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        Iniciando CrystalTides...
      </div>
    );
  }

  // Vista del Instalador
  if (bootContext?.mode === "install") {
    return (
      <InstallerView
        defaultInstallDir={bootContext.defaultInstallDir}
        onLaunchMain={() => setBootContext({ ...bootContext, mode: "launcher" })}
      />
    );
  }

  // Vista del Desinstalador
  if (bootContext?.mode === "uninstall") {
    return <UninstallerView installDir={bootContext.defaultInstallDir} />;
  }

  // Vista Principal del Launcher
  return (
    <div className="app-viewport">
      {/* Fondo con blur dinámico en modales */}
      <WallpaperBackground />

      {/* Switcher de vistas: Login vs Home */}
      {currentView === "login" ? (
        <LoginView />
      ) : (
        <>
          <WindowHeader />
          <HomeDock />
          <BottomBar />

          {/* Modales */}
          <SettingsModal />
          <AccountsModal />
          <AboutModal />
          <CrashReportModal
            isOpen={crashModalOpen}
            onClose={() => setCrashModalOpen(false)}
            onRetry={() => {
              setCrashModalOpen(false);
              launcherActions.startLaunchFlow();
            }}
            crashReason={crashData.reason}
            crashDetails={crashData.details}
            exitCode={crashData.code}
          />
        </>
      )}
    </div>
  );
};
