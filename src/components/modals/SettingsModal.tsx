import React, { useState } from "react";
import { X } from "lucide-react";
import { useLauncherStore, launcherActions, LauncherState } from "../../store/launcherStore";

export const SettingsModal: React.FC = () => {
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const settings = useLauncherStore((s: LauncherState) => s.settings);

  // Local state for interactive editing before saving
  const [mcVersion, setMcVersion] = useState(settings.mcVersion || "1.21.1");
  const [ramMb, setRamMb] = useState(settings.maxRamGb * 1024);
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const [useDesktopRes, setUseDesktopRes] = useState(false);
  const [keepLauncher, setKeepLauncher] = useState(!settings.autoCloseLauncher);
  const [disableBgAnim, setDisableBgAnim] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [disableHardwareAccel, setDisableHardwareAccel] = useState(false);
  const [launcherDir] = useState("C:\\Users\\Haume\\AppData\\Roaming\\.crystaltides");

  if (activeModal !== "settings") return null;

  const handleSave = () => {
    launcherActions.updateSettings({
      mcVersion,
      maxRamGb: Math.round(ramMb / 1024),
      autoCloseLauncher: !keepLauncher,
      resolution: useDesktopRes ? "Desktop" : `${width}x${height}`,
    });
    launcherActions.closeModal();
  };

  const handleReset = () => {
    setMcVersion("1.21.1");
    setRamMb(4096);
    setWidth("1920");
    setHeight("1080");
    setUseDesktopRes(false);
    setKeepLauncher(false);
    setDisableBgAnim(false);
    setShowAllVersions(false);
    setDisableAnimations(false);
    setDisableHardwareAccel(false);
  };

  const VERSION_OPTIONS = showAllVersions
    ? [
        { id: "1.21.1", label: "1.21.1 (NeoForge 21.1.65 - Oficial CrystalTides)" },
        { id: "1.21.0", label: "1.21.0 (Vanilla / Fabric)" },
        { id: "1.20.4", label: "1.20.4 (Fabric)" },
        { id: "1.20.1", label: "1.20.1 (Forge / NeoForge)" },
        { id: "1.19.4", label: "1.19.4 (Vanilla / Fabric)" },
        { id: "1.18.2", label: "1.18.2 (Forge)" },
        { id: "1.16.5", label: "1.16.5 (Forge)" },
        { id: "1.12.2", label: "1.12.2 (Legacy Forge)" },
        { id: "1.8.9", label: "1.8.9 (PvP Classic)" },
      ]
    : [
        { id: "1.21.1", label: "1.21.1 (NeoForge 21.1.65 - Oficial CrystalTides)" },
        { id: "1.21.0", label: "1.21.0 (Vanilla)" },
        { id: "1.20.4", label: "1.20.4 (Fabric)" },
        { id: "1.20.1", label: "1.20.1 (Forge)" },
        { id: "1.19.4", label: "1.19.4 (Vanilla)" },
      ];

  return (
    <div className="papyrus-modal-overlay" onClick={launcherActions.closeModal}>
      <div className="papyrus-settings-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button on Top Right */}
        <button
          onClick={launcherActions.closeModal}
          className="settings-card-close"
          title="Close"
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>

        {/* Title & Save/Reset Actions Header */}
        <div className="settings-header-block">
          <h2 className="settings-main-title">Settings</h2>
          <div className="settings-btn-actions">
            <button onClick={handleSave} className="settings-action-btn">
              Save
            </button>
            <button onClick={handleReset} className="settings-action-btn">
              Reset
            </button>
          </div>
        </div>

        {/* Section 0: Minecraft Version Selector */}
        <div className="settings-section">
          <div className="settings-section-header">
            <span className="settings-label-title">Versión del Juego (Minecraft)</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e", fontFamily: "var(--font-inter)" }}>
              {mcVersion}
            </span>
          </div>

          <div style={{ width: "100%", marginTop: "6px" }}>
            <select
              value={mcVersion}
              onChange={(e) => setMcVersion(e.target.value)}
              className="login-text-input"
              style={{
                width: "100%",
                height: "38px",
                paddingLeft: "12px",
                paddingRight: "12px",
                background: "rgba(5, 9, 14, 0.75)",
                color: "#f1f5f9",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "var(--font-inter)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {VERSION_OPTIONS.map((v) => (
                <option key={v.id} value={v.id} style={{ background: "#0c1118", color: "#f1f5f9" }}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 1: Allocated Memory Slider */}
        <div className="settings-section">
          <div className="settings-section-header">
            <span className="settings-label-title">Allocated Memory</span>
            <span className="settings-ram-counter">{ramMb} mb</span>
          </div>

          <div className="ram-slider-container">
            <input
              type="range"
              min="1024"
              max="16384"
              step="512"
              value={ramMb}
              onChange={(e) => setRamMb(Number(e.target.value))}
              className="papyrus-range-slider"
              style={{
                background: `linear-gradient(to right, #22c55e 0%, #22c55e ${(ramMb / 16384) * 100}%, rgba(255, 255, 255, 0.12) ${(ramMb / 16384) * 100}%, rgba(255, 255, 255, 0.12) 100%)`,
              }}
            />
          </div>
        </div>

        {/* Section 2: Game Resolution */}
        <div className="settings-section">
          <span className="settings-label-title">Game Resolution</span>

          <div className="resolution-inputs-row">
            <div className="res-input-col">
              <label className="res-sub-label">Width</label>
              <input
                type="text"
                value={width}
                disabled={useDesktopRes}
                onChange={(e) => setWidth(e.target.value)}
                className="res-num-input"
              />
            </div>

            <span className="res-times-symbol">✕</span>

            <div className="res-input-col">
              <label className="res-sub-label">Height</label>
              <input
                type="text"
                value={height}
                disabled={useDesktopRes}
                onChange={(e) => setHeight(e.target.value)}
                className="res-num-input"
              />
            </div>
          </div>

          <label className="settings-checkbox-item">
            <input
              type="checkbox"
              checked={useDesktopRes}
              onChange={(e) => setUseDesktopRes(e.target.checked)}
              className="papyrus-checkbox"
            />
            <span className="checkbox-text">Use desktop resolution.</span>
          </label>
        </div>

        {/* Section 3: Advanced Options */}
        <div className="settings-section">
          <span className="settings-label-title">Advanced Options</span>

          <div className="advanced-options-grid">
            {/* Left Column */}
            <div className="advanced-col">
              <label className="settings-checkbox-item">
                <input
                  type="checkbox"
                  checked={keepLauncher}
                  onChange={(e) => setKeepLauncher(e.target.checked)}
                  className="papyrus-checkbox"
                />
                <span className="checkbox-text">Keep launcher after launch.</span>
              </label>

              <label className="settings-checkbox-item">
                <input
                  type="checkbox"
                  checked={disableBgAnim}
                  onChange={(e) => setDisableBgAnim(e.target.checked)}
                  className="papyrus-checkbox"
                />
                <span className="checkbox-text">Disable animated background.</span>
              </label>

              <label className="settings-checkbox-item">
                <input
                  type="checkbox"
                  checked={showAllVersions}
                  onChange={(e) => setShowAllVersions(e.target.checked)}
                  className="papyrus-checkbox"
                />
                <span className="checkbox-text">Show all versions.</span>
              </label>
            </div>

            {/* Right Column */}
            <div className="advanced-col">
              <label className="settings-checkbox-item">
                <input
                  type="checkbox"
                  checked={disableAnimations}
                  onChange={(e) => setDisableAnimations(e.target.checked)}
                  className="papyrus-checkbox"
                />
                <span className="checkbox-text">Disable animations.</span>
              </label>

              <label className="settings-checkbox-item">
                <input
                  type="checkbox"
                  checked={disableHardwareAccel}
                  onChange={(e) => setDisableHardwareAccel(e.target.checked)}
                  className="papyrus-checkbox"
                />
                <div className="checkbox-multi-line">
                  <span className="checkbox-text">Disable hardware acceleration.</span>
                  <span className="checkbox-subtext">(Require restart)</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Section 4: Launcher Directory & Management */}
        <div className="settings-section">
          <span className="settings-label-title">Launcher Directory</span>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={launcherDir}
              readOnly
              className="settings-dir-input"
              style={{ flex: 1 }}
            />
          </div>
        </div>

        {/* Section 5: App Lifecycle */}
        <div className="settings-section" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "14px" }}>
          <span className="settings-label-title" style={{ color: "#FDA4AF" }}>Zona de Mantenimiento</span>
          <p style={{ fontSize: "11px", color: "rgba(248, 250, 252, 0.5)", margin: "4px 0 10px 0" }}>
            Si deseas remover el lanzador o reiniciar tu instalación por completo:
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Deseas abrir el asistente de desinstalación de CrystalTides Launcher?")) {
                window.location.reload();
              }
            }}
            style={{
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "8px",
              color: "#FDA4AF",
              fontSize: "12px",
              fontWeight: 600,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Abrir Desinstalador
          </button>
        </div>
      </div>
    </div>
  );
};
