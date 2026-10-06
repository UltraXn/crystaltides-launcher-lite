import React, { useState } from "react";
import { Loader2, FileText, Minimize2 } from "lucide-react";
import { useLauncherStore, LauncherState } from "../store/launcherStore";
import { LogViewerModal } from "./modals/LogViewerModal";
import logoImg from "../assets/logo.png";

export const GameLaunchOverlay: React.FC = () => {
  const launch = useLauncherStore((s: LauncherState) => s.launch);
  const settings = useLauncherStore((s: LauncherState) => s.settings);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const isLaunching = launch.status !== "IDLE" && launch.status !== "RUNNING";

  if (!isLaunching) return null;

  if (isMinimized) {
    return (
      <div
        role="button"
        tabIndex={0}
        style={{
          position: "fixed",
          bottom: "70px",
          right: "24px",
          zIndex: 999,
          backgroundColor: "#16131B",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          borderRadius: "12px",
          padding: "10px 16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "#F8FAFC",
          cursor: "pointer",
        }}
        onClick={() => setIsMinimized(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsMinimized(false);
          }
        }}
        title="Click para expandir pantalla de carga"
      >
        <Loader2 size={16} color="#38bdf8" style={{ animation: "spin 1s linear infinite" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "11px", fontWeight: 700 }}>Iniciando Minecraft ({launch.progress}%)</span>
          <span style={{ fontSize: "10px", color: "rgba(248, 250, 252, 0.5)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {launch.message}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 9, 14, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        userSelect: "none",
        animation: "fadeIn 0.25s ease-out forwards",
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)",
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#141219",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "18px",
          padding: "32px 28px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.1)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Animated Emblem */}
        <div
          style={{
            position: "relative",
            width: "68px",
            height: "68px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "-6px",
              borderRadius: "50%",
              border: "2px dashed rgba(56, 189, 248, 0.4)",
              animation: "spin 12s linear infinite",
            }}
          />
          <img
            src={logoImg}
            alt="CrystalTides Logo"
            style={{
              width: "56px",
              height: "56px",
              objectFit: "contain",
              filter: "drop-shadow(0 0 12px rgba(56, 189, 248, 0.5))",
              position: "relative",
              zIndex: 1,
            }}
          />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "17px",
            fontWeight: 700,
            margin: "0 0 4px 0",
            color: "#F8FAFC",
            textAlign: "center",
          }}
        >
          Preparando Minecraft
        </h2>

        {/* Selected target version */}
        <span
          style={{
            fontSize: "12px",
            color: "rgba(248, 250, 252, 0.5)",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          {settings.mcVersion} • {settings.loaderType.toUpperCase()} {settings.loaderVersion ? `(${settings.loaderVersion})` : ""}
        </span>

        {/* Progress bar container */}
        <div style={{ width: "100%", marginBottom: "12px" }}>
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: "6px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${launch.progress}%`,
                background: "linear-gradient(90deg, #2dd4bf 0%, #38bdf8 100%)",
                borderRadius: "6px",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 14px rgba(56, 189, 248, 0.6)",
              }}
            />
          </div>
        </div>

        {/* Status text & Percentage */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
          }}
        >
          <span
            style={{
              fontSize: "11.5px",
              color: "#38bdf8",
              fontWeight: 500,
              maxWidth: "80%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {launch.message || "Procesando dependencias..."}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#F8FAFC",
              fontFamily: "monospace",
            }}
          >
            {launch.progress}%
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "10px", width: "100%" }}>
          <button
            type="button"
            onClick={() => setIsLogViewerOpen(true)}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              color: "#F8FAFC",
              fontSize: "12px",
              fontWeight: 600,
              padding: "10px 14px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <FileText size={14} />
            Ver Registros
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "10px",
              color: "#38bdf8",
              fontSize: "12px",
              fontWeight: 600,
              padding: "10px 16px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Minimize2 size={14} />
            Minimizar
          </button>
        </div>
      </div>
    </div>

    {isLogViewerOpen && (
      <LogViewerModal
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
        defaultTab="launcher"
      />
    )}
  </>
);
};
