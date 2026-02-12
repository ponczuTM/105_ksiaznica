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

  // co faktycznie jest załadowane / grane
  const [playingSrc, setPlayingSrc] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  // UI
  const [isBuffering, setIsBuffering] = useState(false);

  // sterowanie
  const [lastCommandId, setLastCommandId] = useState(0);

  const videoRef = useRef(null);
  const latestApiVideoIdRef = useRef(null);

  // żeby nie odpalało w kółko tego samego po zakończeniu
  const endedForIdRef = useRef(null);

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
    endedForIdRef.current = null;
  }, []);

  const stopVideo = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
    }
    // nie czyścimy src – to ma być STOP (pauza), a PLAY ma wznowić
  }, []);

  const playVideo = useCallback((forceRestart = false) => {
    const id = latestApiVideoIdRef.current;
    if (!id) return;

    const src = VIDEO_MAP[String(id)];
    if (!src) return;

    // jeśli nic nie załadowane albo inny ID -> przeładuj
    if (playingId !== String(id)) {
      setPlayingSrc(src);
      setPlayingId(String(id));
      endedForIdRef.current = null;
      return; // onLoadedData odpali play()
    }

    // to samo wideo
    const v = videoRef.current;
    if (!v) return;

    try {
      if (forceRestart || endedForIdRef.current === String(id)) {
        v.currentTime = 0;
        endedForIdRef.current = null;
      }
      v.play().catch(() => {});
    } catch {}
  }, [playingId]);

  // Polling API
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const incomingId = data?.videoid ?? null;
        const incomingCommand = data?.command ?? "NONE";
        const incomingCommandId = Number(data?.commandId ?? 0);

        if (cancelled) return;

        setApiVideoId(incomingId);
        latestApiVideoIdRef.current = incomingId;

        // 1) obsługa komend (tylko gdy commandId się zmienił)
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
            // jeśli było zakończone, to start od początku
            const wasEnded = endedForIdRef.current === String(incomingId);
            playVideo(wasEnded);
            return;
          }
        }

        // 2) automatyczny start tylko gdy:
        // - jest nowy ID
        // - i nie jest to ID, które właśnie zakończyło się (żeby nie loopowało)
        if (incomingId !== null) {
          const idStr = String(incomingId);
          const src = VIDEO_MAP[idStr];
          if (!src) return;

          const endedForThis = endedForIdRef.current === idStr;

          // nowy wybór (inny niż aktualnie grany)
          if (playingId !== idStr) {
            endedForIdRef.current = null;
            setPlayingSrc(src);
            setPlayingId(idStr);
            return;
          }

          // to samo ID, ale jeśli nic nie gra (placeholder) i nie było ended -> odpal
          if (!playingSrc && !endedForThis) {
            setPlayingSrc(src);
            setPlayingId(idStr);
          }
        }
      } catch {
        // silent fail
      }
    };

    tick();
    const t = setInterval(tick, 500);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [backendBase, lastCommandId, hardResetToPlaceholder, stopVideo, playVideo, playingId, playingSrc]);

  // Wideo zakończone
  const handleEnded = useCallback(() => {
    if (playingId) endedForIdRef.current = playingId;

    // wracamy do okna domyślnego (tak jak u Ciebie)
    setPlayingSrc(null);
    setPlayingId(null);
    setIsBuffering(false);
  }, [playingId]);

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
