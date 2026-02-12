// Player.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "./Player.module.css";

import video1 from "../assets/videos/1_optimized.mp4";
import video2 from "../assets/videos/2_optimized.mp4";
import video3 from "../assets/videos/3_optimized.mp4";
import video4 from "../assets/videos/4_optimized.mp4";
import video5 from "../assets/videos/5_optimized.mp4";
import video6 from "../assets/videos/6_optimized.mp4";
import video7 from "../assets/videos/7_optimized.mp4";
import video8 from "../assets/videos/8_optimized.mp4";
import video9 from "../assets/videos/9_optimized.mp4";
import video10 from "../assets/videos/10_optimized.mp4";

const VIDEO_MAP = {
  "1": video1,
  "2": video2,
  "3": video3,
  "4": video4,
  "5": video5,
  "6": video6,
  "7": video7,
  "8": video8,
  "9": video9,
  "10": video10,
};

export default function Player() {
  const backendBase = useMemo(() => {
    const localip = import.meta.env.VITE_BACKEND_IP;
    const port = import.meta.env.VITE_BACKEND_PORT;
    return `http://${localip}:${port}`;
  }, []);

  const [apiVideoId, setApiVideoId] = useState(null);

  const [playingSrc, setPlayingSrc] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const [isBuffering, setIsBuffering] = useState(false);

  const [lastCommandId, setLastCommandId] = useState(0);

  const videoRef = useRef(null);
  const latestApiVideoIdRef = useRef(null);

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
  }, []);

  const stopVideo = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
    }
  }, []);

  const playVideo = useCallback((forceRestart = false) => {
    const id = latestApiVideoIdRef.current;
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
  }, [playingId]);

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
            // PLAY: jeśli nic nie gra -> odpal; jeśli gra -> wznów
            if (incomingId === null) return;
            const v = videoRef.current;
            const forceRestart = !!(v && v.ended);
            playVideo(forceRestart);
            return;
          }
        }

        // Auto-start gdy jest ID i nic nie jest załadowane
        if (incomingId !== null && !playingSrc) {
          const src = VIDEO_MAP[String(incomingId)];
          if (!src) return;
          setPlayingSrc(src);
          setPlayingId(String(incomingId));
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
  }, [backendBase, lastCommandId, hardResetToPlaceholder, stopVideo, playVideo, playingSrc]);

  // Wideo zakończone: 1) lokalnie placeholder, 2) POST /ended -> backend ustawia null i emituje BACK
  const handleEnded = useCallback(async () => {
    const endedId = playingId;

    // lokalnie od razu wróć do placeholdera
    setPlayingSrc(null);
    setPlayingId(null);
    setIsBuffering(false);

    try {
      await fetch(`${backendBase}/ended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoid: endedId }),
      });
    } catch {
      // nawet jak nie dojdzie, lokalnie i tak wróciło do placeholdera
    }
  }, [backendBase, playingId]);

  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);

  const handleLoadedData = useCallback(() => {
    setIsBuffering(false);
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  return (
    <div className={styles.player}>
      <div className={styles.topBar}>
        aktualny videoID: {apiVideoId === null ? "null" : String(apiVideoId)}
        {isBuffering && <span className={styles.buffering}> (buforowanie...)</span>}
      </div>

      <div className={styles.stage}>
        {playingSrc ? (
          <video
            ref={videoRef}
            className={styles.video}
            src={playingSrc}
            autoPlay
            playsInline
            preload="auto"
            controls={false}
            onEnded={handleEnded}
            onWaiting={handleWaiting}
            onCanPlay={handleCanPlay}
            onLoadedData={handleLoadedData}
          />
        ) : (
          <div className={styles.placeholder}>wybierz wideo do odtworzenia</div>
        )}
      </div>
    </div>
  );
}
