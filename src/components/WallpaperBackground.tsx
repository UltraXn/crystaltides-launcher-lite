import React from "react";
import { useLauncherStore, WALLPAPERS, LauncherState } from "../store/launcherStore";

export const WallpaperBackground: React.FC = () => {
  const activeWallpaperId = useLauncherStore((s: LauncherState) => s.activeWallpaperId);
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);

  const currentWallpaper =
    WALLPAPERS.find((w) => w.id === activeWallpaperId) || WALLPAPERS[0];

  const isModalOpen = activeModal !== "none";

  return (
    <div className="wallpaper-layer">
      {/* Background Image with blur effect upon modal opening */}
      <div
        className="wallpaper-img"
        style={{
          backgroundImage: `url(${currentWallpaper.url})`,
          filter: isModalOpen
            ? "blur(18px) brightness(0.35) saturate(1.2)"
            : "blur(0px) brightness(0.68) saturate(1.1)",
        }}
      />

      {/* Vignette Overlay */}
      <div className="wallpaper-vignette" />

      {/* Bioluminescent Ambient Glow */}
      <div
        className="wallpaper-ambient-glow"
        style={{ backgroundColor: currentWallpaper.accent }}
      />
    </div>
  );
};
