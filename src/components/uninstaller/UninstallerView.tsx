import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, CheckCircle2 } from "lucide-react";
import { AmbientBubbles } from "../common/AmbientBubbles";

interface UninstallerViewProps {
  installDir: string;
}

export const UninstallerView: React.FC<UninstallerViewProps> = ({ installDir }) => {
  const [step, setStep] = useState<"confirm" | "uninstalling" | "finish">("confirm");
  const [removeUserData, setRemoveUserData] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Iniciando desinstalación...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartUninstall = async () => {
    setStep("uninstalling");
    setProgress(0.2);
    setStatusText("Cerrando procesos y limpiando accesos directos...");
    setErrorMessage(null);

    try {
      await new Promise((r) => setTimeout(r, 600));
      setProgress(0.5);
      setStatusText("Eliminando claves de registro y entradas del sistema...");

      await invoke("perform_self_uninstall", {
        targetDir: installDir,
        removeUserData,
      });

      setProgress(0.85);
      setStatusText("Programando auto-limpieza del ejecutable...");

      await invoke("schedule_self_deletion", {
        targetDir: installDir,
      });

      await new Promise((r) => setTimeout(r, 600));
      setProgress(1.0);
      setStatusText("Desinstalación completada.");
      setStep("finish");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText("Error durante la desinstalación.");
    }
  };

  const handleClose = async () => {
    try {
      await invoke("close_app");
    } catch (e) {
      console.warn("Could not close uninstaller window:", e);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        background: "radial-gradient(ellipse at top, #1A1118 0%, #0A090E 100%)",
        color: "#F8FAFC",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      <AmbientBubbles count={15} />

      {/* Barra de título */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "38px",
          padding: "0 16px",
          background: "rgba(15, 14, 20, 0.8)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#F43F5E",
              boxShadow: "0 0 8px #F43F5E",
            }}
          />
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "rgba(248, 250, 252, 0.6)", textTransform: "uppercase" }}>
            CrystalTides Launcher · Desinstalador
          </span>
        </div>
      </div>

      {/* Contenido principal */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          position: "relative",
          zIndex: 10,
        }}
      >
        {step === "confirm" && (
          <div style={{ maxWidth: "500px", width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "20px",
                background: "linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(239, 68, 68, 0.05))",
                border: "1px solid rgba(244, 63, 94, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
                boxShadow: "0 8px 32px rgba(244, 63, 94, 0.15)",
              }}
            >
              <Trash2 size={32} color="#F43F5E" />
            </div>

            <h1 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 8px 0" }}>
              ¿Desinstalar CrystalTides Launcher?
            </h1>
            <p style={{ fontSize: "13px", color: "rgba(248, 250, 252, 0.65)", margin: "0 0 24px 0", lineHeight: "1.5" }}>
              Esta acción eliminará el lanzador y sus accesos directos del sistema en la ruta:
              <br />
              <code style={{ fontSize: "11px", color: "#F43F5E", background: "rgba(255, 255, 255, 0.04)", padding: "2px 6px", borderRadius: "4px" }}>
                {installDir}
              </code>
            </p>

            {/* Checkbox de datos de usuario */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "14px",
                textAlign: "left",
                marginBottom: "28px",
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                id="removeUserData"
                checked={removeUserData}
                onChange={(e) => setRemoveUserData(e.target.checked)}
                style={{ accentColor: "#F43F5E", width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
              />
              <div>
                <label htmlFor="removeUserData" style={{ fontSize: "13px", fontWeight: 600, color: "#F8FAFC", cursor: "pointer", display: "block" }}>
                  Eliminar también perfiles de juego, mods y mundos guardados
                </label>
                <span style={{ fontSize: "11px", color: "rgba(248, 250, 252, 0.5)" }}>
                  Si dejas esta casilla desmarcada, tus mods y configuraciones se mantendrán intactos para futuras instalaciones.
                </span>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleStartUninstall}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px 20px",
                  color: "#FFF",
                  fontSize: "14px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(244, 63, 94, 0.3)",
                }}
              >
                <Trash2 size={16} /> Desinstalar
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "12px",
                  padding: "14px 20px",
                  color: "#F8FAFC",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === "uninstalling" && (
          <div style={{ maxWidth: "460px", width: "100%", textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0" }}>Desinstalando...</h2>
            <p style={{ fontSize: "13px", color: "rgba(248, 250, 252, 0.6)", margin: "0 0 24px 0" }}>{statusText}</p>

            <div
              style={{
                width: "100%",
                height: "10px",
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: "999px",
                overflow: "hidden",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, #F43F5E, #E11D48)",
                  borderRadius: "999px",
                  transition: "width 0.4s ease-out",
                  boxShadow: "0 0 12px rgba(244, 63, 94, 0.6)",
                }}
              />
            </div>
            <div style={{ fontSize: "11px", color: "rgba(248, 250, 252, 0.45)", fontWeight: 600 }}>
              {Math.round(progress * 100)}%
            </div>

            {errorMessage && (
              <div style={{ marginTop: "20px", padding: "12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#FCA5A5", fontSize: "12px" }}>
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {step === "finish" && (
          <div style={{ maxWidth: "460px", width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(45, 212, 191, 0.15)",
                border: "1px solid #2DD4BF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
                boxShadow: "0 0 24px rgba(45, 212, 191, 0.25)",
              }}
            >
              <CheckCircle2 size={32} color="#2DD4BF" />
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 8px 0" }}>Desinstalación Finalizada</h2>
            <p style={{ fontSize: "13px", color: "rgba(248, 250, 252, 0.65)", margin: "0 0 32px 0", lineHeight: "1.5" }}>
              CrystalTides Launcher ha sido eliminado correctamente de tu equipo. La ventana se cerrará automáticamente.
            </p>

            <button
              onClick={handleClose}
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "12px",
                padding: "14px 20px",
                color: "#F8FAFC",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cerrar Asistente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
