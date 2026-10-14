import React from "react";
import { Minus, Square, X } from "lucide-react";

export const WindowHeader: React.FC = () => {
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
      <div style={{ flex: 1 }} />

      {/* Top-Right Window Controls */}
      <div className="papyrus-window-controls">
        <button onClick={handleMinimize} className="papyrus-win-btn" title="Minimizar">
          <Minus style={{ width: "14px", height: "14px" }} />
        </button>

        <button onClick={handleMaximize} className="papyrus-win-btn" title="Maximizar">
          <Square style={{ width: "12px", height: "12px" }} />
        </button>

        <button onClick={handleClose} className="papyrus-win-btn close" title="Cerrar">
          <X style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
    </header>
  );
};
