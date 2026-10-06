import React, { useRef, useEffect } from "react";
import { useLauncherStore, WALLPAPERS, LauncherState } from "../store/launcherStore";
import { isVideoSource } from "../utils/wallpaperStorage";

export const WallpaperBackground: React.FC = () => {
  const activeWallpaperId = useLauncherStore((s: LauncherState) => s.activeWallpaperId);
  const customWallpaperUrl = useLauncherStore((s: LauncherState) => s.customWallpaperUrl);
  const isVideoWallpaper = useLauncherStore((s: LauncherState) => s.isVideoWallpaper);
  const wallpaperMuted = useLauncherStore((s: LauncherState) => s.wallpaperMuted);
  const wallpaperVolume = useLauncherStore((s: LauncherState) => s.wallpaperVolume);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);

  const videoRef = useRef<HTMLVideoElement>(null);

  const defaultWallpaper =
    WALLPAPERS.find((w) => w.id === activeWallpaperId) || WALLPAPERS[0];

  const currentBgUrl = customWallpaperUrl || defaultWallpaper.url;
  const currentAccent = accentColor || (customWallpaperUrl ? '#00e5ff' : defaultWallpaper.accent);

  const isModalOpen = activeModal !== 'none';
  const isVideo = isVideoWallpaper || isVideoSource(currentBgUrl);

  // Synchronize audio volume and muted state
  useEffect(() => {
    if (videoRef.current && isVideo) {
      const targetVolume = isModalOpen ? wallpaperVolume * 0.4 : wallpaperVolume;
      videoRef.current.volume = Math.max(0, Math.min(1, targetVolume));
      videoRef.current.muted = wallpaperMuted;

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Video autoplay policy note:', err);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [isVideo, wallpaperVolume, wallpaperMuted, isModalOpen, currentBgUrl]);

  return (
    <div className="wallpaper-layer">
      {isVideo ? (
        <video
          ref={videoRef}
          key={currentBgUrl}
          src={currentBgUrl}
          autoPlay
          loop
          playsInline
          muted={wallpaperMuted}
          className="wallpaper-video"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: isModalOpen
              ? 'blur(18px) brightness(0.35) saturate(1.2)'
              : 'blur(0px) brightness(0.68) saturate(1.1)',
            transition: 'filter 0.3s ease',
            pointerEvents: 'none',
          }}
        >
          <track kind="captions" />
        </video>
      ) : (
        <div
          className="wallpaper-img"
          style={{
            backgroundImage: `url("${currentBgUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: isModalOpen
              ? 'blur(18px) brightness(0.35) saturate(1.2)'
              : 'blur(0px) brightness(0.68) saturate(1.1)',
            transition: 'filter 0.3s ease',
          }}
        />
      )}

      {/* Vignette Overlay */}
      <div className="wallpaper-vignette" />

      {/* Bioluminescent Ambient Glow */}
      <div
        className="wallpaper-ambient-glow"
        style={{ backgroundColor: currentAccent }}
      />
    </div>
  );
};
