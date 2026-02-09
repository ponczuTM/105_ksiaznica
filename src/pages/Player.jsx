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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const videoRef = useRef(null);
  const preloadedVideos = useRef(new Map());
  const currentPreloadRef = useRef(null);

  // Preloadowanie wideo w tle
  const preloadVideo = useCallback((videoId) => {
    if (!videoId || preloadedVideos.current.has(videoId)) return;

    const src = VIDEO_MAP[String(videoId)];
    if (!src) return;

    //Tworzenie ukrytego elementu video do preloadowania
    const videoElement = document.createElement("video");
    videoElement.src = src;
    videoElement.preload = "auto";
    videoElement.playsInline = true;
    
    // Rozpoczęcie ładowania
    videoElement.load();

    // Zapisanie referencji
    preloadedVideos.current.set(videoId, {
      element: videoElement,
      src: src,
      loaded: false
    });

    // Event listeners dla preloadingu
    videoElement.addEventListener("canplaythrough", () => {
      const entry = preloadedVideos.current.get(videoId);
      if (entry) {
        entry.loaded = true;
      }
    }, { once: true });

    // Cleanup starszych preloadów (max 3 w pamięci)
    if (preloadedVideos.current.size > 3) {
      const firstKey = preloadedVideos.current.keys().next().value;
      const oldEntry = preloadedVideos.current.get(firstKey);
      if (oldEntry?.element) {
        oldEntry.element.src = "";
        oldEntry.element.load();
      }
      preloadedVideos.current.delete(firstKey);
    }
  }, []);

  // Polling API
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const incoming = data?.videoid ?? null;
        if (!cancelled) {
          setApiVideoId(incoming);

          // Preloadowanie nowego wideo jeśli się zmienił ID
          if (incoming !== null && incoming !== playingId) {
            preloadVideo(incoming);
          }
        }

        // Jeśli już gra coś, nie przerywaj
        if (isPlaying) return;
        if (incoming === null) return;

        const src = VIDEO_MAP[String(incoming)];
        if (!src) return;

        // Odtwarzanie wideo
        setPlayingSrc(src);
        setPlayingId(String(incoming));
        setIsPlaying(true);
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
  }, [backendBase, isPlaying, playingId, preloadVideo]);

  // Obsługa zakończenia wideo
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setPlayingSrc(null);
    setPlayingId(null);
    setIsBuffering(false);
  }, []);

  // Obsługa eventów bufferowania
  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleLoadedData = useCallback(() => {
    setIsBuffering(false);
    // Wymuszenie odtwarzania
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Automatyczne odtwarzanie zablokowane przez przeglądarkę
      });
    }
  }, []);

  // Cleanup przy unmount
  useEffect(() => {
    return () => {
      // Zwolnienie pamięci
      preloadedVideos.current.forEach((entry) => {
        if (entry.element) {
          entry.element.src = "";
          entry.element.load();
        }
      });
      preloadedVideos.current.clear();
    };
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