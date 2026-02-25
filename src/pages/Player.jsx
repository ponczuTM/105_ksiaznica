// Player.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "./Player.module.css";

import kopernik_en_1 from "../assets/videos/kopernik_en_1.mp4";
import kopernik_en_2 from "../assets/videos/kopernik_en_2.mp4";
import kopernik_en_3 from "../assets/videos/kopernik_en_3.mp4";
import kopernik_waiting from "../assets/videos/kopernik_waiting.mp4";

const VIDEO_MAP = {
  "1": kopernik_en_1,
  "2": kopernik_en_2,
  "3": kopernik_en_3,
  "4": kopernik_waiting, // DOMYŚLNE (loop w fullscreen gdy backend = null)
};

const DEFAULT_ID = "4";
const DEFAULT_SRC = kopernik_waiting;

export default function Player() {
  const backendIp = import.meta.env.VITE_BACKEND_IP;
  const backendPort = import.meta.env.VITE_BACKEND_PORT;

  const backendBase = useMemo(() => {
    return `http://${backendIp}:${backendPort}`;
  }, [backendIp, backendPort]);

  // pokazuj IP tylko przez 60s od startu Playera
  const [showIp, setShowIp] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowIp(false), 60_000);
    return () => clearTimeout(t);
  }, []);

  const [apiVideoId, setApiVideoId] = useState(null);

  const [playingSrc, setPlayingSrc] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const [lastCommandId, setLastCommandId] = useState(0);

  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const latestApiVideoIdRef = useRef(null);

  // fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
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
    } catch {
      // silent
    }
  }, []);

  const ensureDefaultIfNeeded = useCallback(() => {
    // w fullscreen + backend null => ma grać domyślne w loopie
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

    // jeśli jesteśmy w fullscreenie i backend jest null -> od razu odpal domyślne
    // (zostaw w microtask, żeby state się ułożył)
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

      // jeśli backend null, a jesteśmy w fullscreen -> odpal domyślne
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
        return; // onLoadedData odpali play()
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

  // Polling backend
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

        setApiVideoId(incomingId);
        latestApiVideoIdRef.current = incomingId;

        // Komendy tylko gdy commandId się zmienił
        if (incomingCommandId !== lastCommandId) {
          setLastCommandId(incomingCommandId);

          if (incomingCommand === "BACK") {
            hardResetToPlaceholder();
            return;
          }

          if (incomingCommand === "STOP") {
            stopVideo();
            return;
          }

          if (incomingCommand === "PLAY") {
            // PLAY: jeśli backend null i fullscreen -> domyślne; inaczej normalnie
            const v = videoRef.current;
            const forceRestart = !!(v && v.ended);
            playVideo(forceRestart);
            return;
          }
        }

        // Auto-start:
        // - jeśli jest ID 1/2/3 i nic nie jest załadowane -> ładuj to ID
        if (incomingId !== null && !playingSrc) {
          const src = VIDEO_MAP[String(incomingId)];
          if (!src) return;
          setPlayingSrc(src);
          setPlayingId(String(incomingId));
          return;
        }

        // - jeśli backend null i fullscreen -> odpal domyślne w loopie
        if (incomingId === null) {
          ensureDefaultIfNeeded();
        }
      } catch {
        // silent
      }
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

  // Wideo zakończone: 1) lokalnie placeholder, 2) POST /ended -> backend ustawia null i emituje BACK
  const handleEnded = useCallback(async () => {
    // domyślne w loopie nie powinno tu wpadać (bo ma loop), ale jakby jednak:
    if (playingId === DEFAULT_ID && latestApiVideoIdRef.current === null) return;

    const endedId = playingId;

    // lokalnie od razu wróć do placeholdera
    setPlayingSrc(null);
    setPlayingId(null);
    setIsBuffering(false);

    // jeśli jesteśmy w fullscreen + backend null -> natychmiast wróć do domyślnego
    queueMicrotask(() => ensureDefaultIfNeeded());

    try {
      await fetch(`${backendBase}/ended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoid: endedId }),
      });
    } catch {
      // silent
    }
  }, [backendBase, playingId, ensureDefaultIfNeeded]);

  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);

  const handleLoadedData = useCallback(() => {
    setIsBuffering(false);
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  const isDefaultLoop = isFullscreen && apiVideoId === null && playingId === DEFAULT_ID;

  return (
    <div className={styles.player}>
      <div className={styles.topBar}>
        aktualny videoID: {apiVideoId === null ? "null" : String(apiVideoId)}
        {isBuffering && <span className={styles.buffering}> (buforowanie...)</span>}
        {showIp && (
          <span className={styles.ipHint}>
            {" "}
            | backend: {backendIp}:{backendPort}
          </span>
        )}
      </div>

      <div className={styles.stage} ref={stageRef}>
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
              // requestFullscreen MUSI być w user-gesture
              enterFullscreen();
              // a potem (już po wejściu) polling/ensureDefault odpali domyślne
              // ale dopychamy też lokalnie:
              queueMicrotask(() => ensureDefaultIfNeeded());
            }}
          >
            PEŁNY EKRAN
          </button>
        )}
      </div>
    </div>
  );
}
