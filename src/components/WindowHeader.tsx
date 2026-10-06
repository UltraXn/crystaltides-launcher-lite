import React from "react";
import { Minus, Square, X } from "lucide-react";
import logoImg from "../assets/logo.png";
import { useT } from "../store/launcherStore";

export const WindowHeader: React.FC = () => {
  const t = useT();

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().minimize();
    } catch {
      console.log("[Window] Minimize (Web mode)");
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().toggleMaximize();
    } catch {
      console.log("[Window] Maximize (Web mode)");
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().close();
    } catch {
      console.log("[Window] Close (Web mode)");
    }
  };

  return (
    <header data-tauri-drag-region className="papyrus-window-header">
      {/* Left Branding: Logo + Title + Lite Tech Pill */}
      <div className="papyrus-header-branding" data-tauri-drag-region>
        <img
          src={logoImg}
          alt="CrystalTides Logo"
          className="papyrus-header-logo"
        />
        <div className="papyrus-header-title">
          <span>CrystalTides</span>
          <span className="papyrus-header-title-launcher">Launcher</span>
        </div>
        <div className="papyrus-header-lite-badge" title={t.window.badgeTitle}>
          <span className="papyrus-header-lite-dot" />
          <span>LITE</span>
        </div>
      </div>

      <div style={{ flex: 1 }} data-tauri-drag-region />

      {/* Top-Right Window Controls */}
      <div className="papyrus-window-controls">
        <button onClick={handleMinimize} className="papyrus-win-btn" title={t.window.minimize}>
          <Minus style={{ width: "14px", height: "14px" }} />
        </button>

        <button onClick={handleMaximize} className="papyrus-win-btn" title={t.window.maximize}>
          <Square style={{ width: "12px", height: "12px" }} />
        </button>

        <button onClick={handleClose} className="papyrus-win-btn close" title={t.window.close}>
          <X style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
    </header>
  );
};

