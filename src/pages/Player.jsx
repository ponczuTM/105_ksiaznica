// Player.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "./Player.module.css";

import Robot from "./Robot";

import kopernik_en_1 from "../assets/videos/kopernik_en_1.mp4";
import kopernik_en_2 from "../assets/videos/kopernik_en_2.mp4";
import kopernik_en_3 from "../assets/videos/kopernik_en_3.mp4";

import kopernik_pl_1 from "../assets/videos/kopernik_pl_1.mp4";
import kopernik_pl_2 from "../assets/videos/kopernik_pl_2.mp4";
import kopernik_pl_3 from "../assets/videos/kopernik_pl_3.mp4";

import kopernik_waiting from "../assets/videos/kopernik_waiting.mp4";

import footer_page from "../assets/images/footer_page.png";
import page_bg from "../assets/images/page_bg.png";

const VIDEO_MAP = {
  "1": kopernik_en_1,
  "2": kopernik_en_2,
  "3": kopernik_en_3,
  "5": kopernik_pl_1,
  "6": kopernik_pl_2,
  "7": kopernik_pl_3,
  "4": kopernik_waiting,
};

const DEFAULT_ID = "4";
const DEFAULT_SRC = kopernik_waiting;

export default function Player() {
  const backendIp = import.meta.env.VITE_BACKEND_IP;
  const backendPort = import.meta.env.VITE_BACKEND_PORT;

  const backendBase = useMemo(() => {
    return `http://${backendIp}:${backendPort}`;
  }, [backendIp, backendPort]);

  const [showIp, setShowIp] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowIp(false), 60000);
    return () => clearTimeout(t);
  }, []);

  const [apiVideoId, setApiVideoId] = useState(null);
  const [playingSrc, setPlayingSrc] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [lastCommandId, setLastCommandId] = useState(0);
  const [robotMode, setRobotMode] = useState(false);

  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const latestApiVideoIdRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    onFsChange();
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = stageRef.current || document.documentElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      }
    } catch {}
  }, []);

  const ensureDefaultIfNeeded = useCallback(() => {
    if (!isFullscreen) return;
    if (latestApiVideoIdRef.current !== null) return;

    if (playingId !== DEFAULT_ID) {
      setIsBuffering(false);
      setPlayingSrc(DEFAULT_SRC);
      setPlayingId(DEFAULT_ID);
    }
  }, [isFullscreen, playingId]);

  const hardResetToPlaceholder = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
    setIsBuffering(false);
    setPlayingSrc(null);
    setPlayingId(null);
    queueMicrotask(() => ensureDefaultIfNeeded());
  }, [ensureDefaultIfNeeded]);

  const stopVideo = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
    }
  }, []);

  const playVideo = useCallback(
    (forceRestart = false) => {
      const id = latestApiVideoIdRef.current;

      if (id === null) {
        ensureDefaultIfNeeded();
        return;
      }

      if (!id) return;

      const src = VIDEO_MAP[String(id)];
      if (!src) return;

      if (playingId !== String(id)) {
        setPlayingSrc(src);
        setPlayingId(String(id));
        return;
      }

      const v = videoRef.current;
      if (!v) return;

      try {
        if (forceRestart) v.currentTime = 0;
        v.play().catch(() => {});
      } catch {}
    },
    [playingId, ensureDefaultIfNeeded]
  );

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const incomingId = data?.videoid ?? null;
        const incomingCommand = data?.command ?? "NONE";
        const incomingCommandId = Number(data?.commandId ?? 0);
        const incomingRobotMode = data?.robotMode ?? false;

        setRobotMode(incomingRobotMode);
        setApiVideoId(incomingId);
        latestApiVideoIdRef.current = incomingId;

        // gdy jesteśmy w trybie robota, nie ruszamy normalnego odtwarzacza
        if (incomingRobotMode) return;

        if (incomingCommandId !== lastCommandId) {
          setLastCommandId(incomingCommandId);

          if (incomingCommand === "BACK" || incomingCommand === "ROBOT") {
            hardResetToPlaceholder();
            return;
          }

          if (incomingCommand === "STOP") {
            stopVideo();
            return;
          }

          if (incomingCommand === "PLAY") {
            const v = videoRef.current;
            const forceRestart = !!(v && v.ended);
            playVideo(forceRestart);
            return;
          }
        }

        if (incomingId !== null && !playingSrc) {
          const src = VIDEO_MAP[String(incomingId)];
          if (!src) return;
          setPlayingSrc(src);
          setPlayingId(String(incomingId));
          return;
        }

        if (incomingId === null) {
          ensureDefaultIfNeeded();
        }
      } catch {}
    };

    tick();
    const t = setInterval(tick, 500);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [
    backendBase,
    lastCommandId,
    hardResetToPlaceholder,
    stopVideo,
    playVideo,
    playingSrc,
    ensureDefaultIfNeeded,
  ]);

  const handleEnded = useCallback(async () => {
    if (playingId === DEFAULT_ID && latestApiVideoIdRef.current === null)
      return;

    const endedId = playingId;

    setPlayingSrc(null);
    setPlayingId(null);
    setIsBuffering(false);

    queueMicrotask(() => ensureDefaultIfNeeded());

    try {
      await fetch(`${backendBase}/ended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoid: endedId }),
      });
    } catch {}
  }, [backendBase, playingId, ensureDefaultIfNeeded]);

  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);

  const handleLoadedData = useCallback(() => {
    setIsBuffering(false);
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  const isDefaultLoop =
    isFullscreen && apiVideoId === null && playingId === DEFAULT_ID;

  // Oba widoki żyją w tym samym drzewie DOM — nigdy nie ma unmount/remount.
  // CSS visibility decyduje co jest widoczne.
  return (
    <div className={styles.player}>
      {/* topBar — ukryty w trybie robota */}
      {!robotMode && (
        <div className={styles.topBar}>
          aktualny videoID: {apiVideoId === null ? "null" : String(apiVideoId)}
          {isBuffering && (
            <span className={styles.buffering}> (buforowanie...)</span>
          )}
          {showIp && (
            <span className={styles.ipHint}>
              {" "}
              | backend: {backendIp}:{backendPort}
            </span>
          )}
        </div>
      )}

      {/*
        Jeden stały kontener — stageRef nigdy nie jest odmontowany.
        Dzięki temu fullscreen przeżywa przełączenie robotMode.
      */}
      <div
        className={styles.stage}
        ref={stageRef}
        style={{
          backgroundImage: `url(${page_bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* === WIDOK ROBOTA — widoczny/ukryty przez display === */}
        <div
          style={{
            display: robotMode ? "flex" : "none",
            position: "absolute",
            inset: 0,
            zIndex: 10,
          }}
        >
          <Robot backendBase={backendBase} />
        </div>

        {/* === NORMALNY PLAYER — widoczny gdy nie ma robota === */}
        <div
          style={{
            display: robotMode ? "none" : "contents",
          }}
        >
          {playingSrc ? (
            <video
              ref={videoRef}
              className={styles.video}
              src={playingSrc}
              autoPlay
              playsInline
              preload="auto"
              controls={false}
              loop={isDefaultLoop}
              onEnded={handleEnded}
              onWaiting={handleWaiting}
              onCanPlay={handleCanPlay}
              onLoadedData={handleLoadedData}
            />
          ) : (
            <button
              type="button"
              className={styles.fullscreenBtn}
              onClick={() => {
                enterFullscreen();
                queueMicrotask(() => ensureDefaultIfNeeded());
              }}
            >
              PEŁNY EKRAN
            </button>
          )}
        </div>

        <img src={footer_page} alt="footer" className={styles.footer} />
      </div>
    </div>
  );
}
