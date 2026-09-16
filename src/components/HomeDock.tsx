import React from "react";
import { Info, Settings, Rocket, Loader2, CheckCircle2, User } from "lucide-react";
import { useLauncherStore, launcherActions, LauncherState, UserAccount } from "../store/launcherStore";

export const HomeDock: React.FC = () => {
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);
  const launch = useLauncherStore((s: LauncherState) => s.launch);

  const activeAccount = accounts.find((a: UserAccount) => a.id === activeAccountId);
  const isLaunching = launch.status !== "IDLE" && launch.status !== "RUNNING";
  const isRunning = launch.status === "RUNNING";

  return (
    <div className="home-screen-center">
      {/* 4-Segment Unified Horizontal Dock */}
      <div className="home-unified-dock">
        {/* Segment 1: About */}
        <button
          onClick={() => launcherActions.openModal("about")}
          className="dock-segment"
        >
          <div className="dock-icon-wrapper">
            <Info style={{ width: "24px", height: "24px" }} />
          </div>
          <span className="dock-label">About</span>
        </button>

        {/* Segment 2: Accounts */}
        <button
          onClick={() => launcherActions.openModal("accounts")}
          className="dock-segment"
        >
          <div className="dock-icon-wrapper avatar-box">
            {activeAccount?.skinUrl ? (
              <img
                src={activeAccount.skinUrl}
                alt="Skin"
                className="dock-player-head"
              />
            ) : activeAccount?.uuid && activeAccount.uuid !== "00000000-0000-0000-0000-000000000000" ? (
              <img
                src={`https://mc-heads.net/avatar/${activeAccount.uuid}/48`}
                alt="Skin"
                className="dock-player-head"
              />
            ) : (
              <User style={{ width: "20px", height: "20px" }} />
            )}
          </div>
          <span className="dock-label">Accounts</span>
        </button>

        {/* Segment 3: Settings */}
        <button
          onClick={() => launcherActions.openModal("settings")}
          className="dock-segment"
        >
          <div className="dock-icon-wrapper">
            <Settings style={{ width: "24px", height: "24px" }} />
          </div>
          <span className="dock-label">Settings</span>
        </button>

        {/* Segment 4: Start Game / Launch / Stop */}
        <button
          onClick={() => {
            if (isRunning) {
              launcherActions.killGameFlow();
            } else if (!isLaunching) {
              launcherActions.startLaunchFlow();
            }
          }}
          disabled={isLaunching}
          className={`dock-segment start-game ${isRunning ? "running" : isLaunching ? "launching" : ""}`}
          title={isRunning ? "Juego en ejecución (Click para cerrar proceso)" : isLaunching ? launch.message : "Iniciar Minecraft"}
        >
          <div className="dock-icon-wrapper green-icon">
            {isRunning ? (
              <CheckCircle2 style={{ width: "26px", height: "26px" }} />
            ) : isLaunching ? (
              <Loader2 style={{ width: "26px", height: "26px", animation: "spin 1s linear infinite" }} />
            ) : (
              <Rocket style={{ width: "26px", height: "26px", transform: "rotate(45deg)" }} />
            )}
          </div>
          <span className="dock-label green-label">
            {isRunning ? "Running..." : isLaunching ? `${launch.progress}%` : "Start Game"}
          </span>

          {/* Launching progress underline */}
          {isLaunching && (
            <div className="dock-launch-progress">
              <div
                className="dock-launch-fill"
                style={{ width: `${launch.progress}%` }}
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
