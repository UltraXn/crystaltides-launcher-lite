import React, { useState } from "react";
import { AlertOctagon, Copy, Check, RefreshCw, X } from "lucide-react";

interface CrashReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  crashReason?: string;
  crashDetails?: string;
  exitCode?: number;
}

export const CrashReportModal: React.FC<CrashReportModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  crashReason = "Incompatibilidad de mods o fallo de memoria de Java",
  crashDetails = "java.lang.OutOfMemoryError: Java heap space",
  exitCode = 1,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyReport = async () => {
    const report = `[CrystalTides Crash Report]\nMotivo: ${crashReason}\nCódigo de salida: ${exitCode}\nDetalles:\n${crashDetails}`;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Could not copy crash report:", e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "#16131B",
          border: "1px solid rgba(244, 63, 94, 0.3)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(244, 63, 94, 0.15)",
          color: "#F8FAFC",
          position: "relative",
        }}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "rgba(248, 250, 252, 0.5)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        {/* Encabezado del Crash */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid #F43F5E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertOctagon size={22} color="#F43F5E" />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>El juego se cerró inesperadamente</h3>
            <span style={{ fontSize: "12px", color: "rgba(248, 250, 252, 0.5)" }}>
              Código de salida: {exitCode}
            </span>
          </div>
        </div>

        {/* Diagnóstico en caliente */}
        <div
          style={{
            background: "rgba(244, 63, 94, 0.08)",
            border: "1px solid rgba(244, 63, 94, 0.2)",
            borderRadius: "10px",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#FDA4AF", marginBottom: "4px" }}>
            Causa detectada:
          </div>
          <div style={{ fontSize: "13px", color: "#F8FAFC" }}>{crashReason}</div>
        </div>

        {/* Consola resumida de error */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(248, 250, 252, 0.5)", textTransform: "uppercase" }}>
            Detalle del error:
          </label>
          <pre
            style={{
              background: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "#FCA5A5",
              maxHeight: "120px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: "6px 0 0 0",
            }}
          >
            {crashDetails}
          </pre>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)",
              border: "none",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#0A090E",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
          <button
            onClick={handleCopyReport}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#F8FAFC",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={14} color="#2DD4BF" /> : <Copy size={14} />}
            {copied ? "¡Copiado!" : "Copiar reporte"}
          </button>
        </div>
      </div>
    </div>
  );
};
