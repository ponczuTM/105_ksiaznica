// Player.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Player.module.css";

import video1 from "../assets/videos/1.mp4";
import video2 from "../assets/videos/2.mp4";
import video3 from "../assets/videos/3.mp4";
import video4 from "../assets/videos/4.mp4";
import video5 from "../assets/videos/5.mp4";
import video6 from "../assets/videos/6.mp4";
import video7 from "../assets/videos/7.mp4";
import video8 from "../assets/videos/8.mp4";
import video9 from "../assets/videos/9.mp4";
import video10 from "../assets/videos/10.mp4";

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
  const [playerKey, setPlayerKey] = useState(0);

  // preload status (UI)
  const totalVideos = Object.keys(VIDEO_MAP).length;
  const [preloadedCount, setPreloadedCount] = useState(0);
  const [preloadDone, setPreloadDone] = useState(false);

  const videoRef = useRef(null);

  // Trzymamy w RAM: id -> objectURL (blob)
  const preloadedUrlsRef = useRef(new Map());
  const pendingIdRef = useRef(null);

  // 1) Preload wszystkich filmów do pamięci (Blob -> objectURL)
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    const preloadAll = async () => {
      const entries = Object.entries(VIDEO_MAP);

      let loaded = 0;

      for (const [id, url] of entries) {
        if (cancelled) break;

        // jeśli już jest (np. hot reload), pomiń
        if (preloadedUrlsRef.current.has(id)) {
          loaded += 1;
          if (!cancelled) setPreloadedCount(loaded);
          continue;
        }

        try {
          const res = await fetch(url, {
            signal: ac.signal,
            // Vite/assets i tak są statyczne, więc cache zwykle zadziała,
            // ale my i tak robimy Blob żeby mieć pewność.
            cache: "force-cache",
          });

          if (!res.ok) throw new Error(`Preload failed: ${id}`);

          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);

          preloadedUrlsRef.current.set(id, objectUrl);
        } catch (e) {
          // Jeśli preload jednego padnie, nie wywracaj appki.
          // Po prostu zostaw fallback na normalny src.
        } finally {
          loaded += 1;
          if (!cancelled) setPreloadedCount(loaded);
        }
      }

      if (!cancelled) setPreloadDone(true);
    };

    preloadAll();

    return () => {
      cancelled = true;
      ac.abort();

      // Sprzątanie objectURL (ważne, bo inaczej wycieki pamięci)
      for (const url of preloadedUrlsRef.current.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      preloadedUrlsRef.current.clear();
    };
  }, []);

  // 2) Polling backendu po videoid + start odtwarzania
  useEffect(() => {
    let cancelled = false;

    const startVideo = (idStr) => {
      const preloaded = preloadedUrlsRef.current.get(idStr);
      const fallback = VIDEO_MAP[idStr];

      const src = preloaded || fallback;
      if (!src) return;

      setPlayingSrc(src);
      setPlayingId(idStr);
      setIsPlaying(true);
      setPlayerKey((k) => k + 1);
    };

    const tick = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        const incoming = data?.videoid ?? null;

        if (!cancelled) setApiVideoId(incoming);

        if (incoming === null) return;

        const idStr = String(incoming);
        if (!VIDEO_MAP[idStr]) return;

        // jeśli gra, zapamiętaj "kolejkę" (najnowszy wygrywa)
        if (isPlaying) {
          pendingIdRef.current = idStr;
          return;
        }

        // jeśli nie gra, odpal od razu
        startVideo(idStr);
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
  }, [backendBase, isPlaying]);

  // 3) Dopalenie play() po zamianie src (czasem przeglądarka potrzebuje kopniaka)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playingSrc) return;

    // próbujemy wystartować; jak autoplay zablokowany — nic nie wywalamy
    const p = v.play?.();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [playingSrc, playerKey]);

  const handleEnded = () => {
    setIsPlaying(false);
    setPlayingSrc(null);
    setPlayingId(null);

    // jeśli w trakcie grania przyszło nowe id — odpal je teraz
    const next = pendingIdRef.current;
    pendingIdRef.current = null;

    if (next && VIDEO_MAP[next]) {
      const preloaded = preloadedUrlsRef.current.get(next);
      const fallback = VIDEO_MAP[next];
      const src = preloaded || fallback;
      if (!src) return;

      setPlayingSrc(src);
      setPlayingId(next);
      setIsPlaying(true);
      setPlayerKey((k) => k + 1);
    }
  };

  return (
    <div className={styles.player}>
      <div className={styles.topBar}>
        aktualny videoID: {apiVideoId === null ? "null" : String(apiVideoId)}
        <span style={{ marginLeft: 12 }}>
          preload: {preloadedCount}/{totalVideos}
          {preloadDone ? " ✅" : " …"}
        </span>
      </div>

      <div className={styles.stage}>
        {playingSrc ? (
          <video
            key={playerKey}
            ref={videoRef}
            className={styles.video}
            src={playingSrc}
            autoPlay
            playsInline
            preload="auto"
            controls={false}
            // jeśli autoplay bywa blokowany, dodaj muted:
            // muted
            onEnded={handleEnded}
          />
        ) : (
          <div className={styles.placeholder}>
            {preloadDone
              ? "wybierz wideo do odtworzenia"
              : "wczytuję wideo do pamięci…"}
          </div>
        )}
      </div>
    </div>
  );
}
