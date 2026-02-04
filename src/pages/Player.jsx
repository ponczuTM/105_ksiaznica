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

  const videoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const incoming = data?.videoid ?? null;
        if (!cancelled) setApiVideoId(incoming);

        if (isPlaying) return;
        if (incoming === null) return;

        const src = VIDEO_MAP[String(incoming)];
        if (!src) return;

        setPlayingSrc(src);
        setPlayingId(String(incoming));
        setIsPlaying(true);
        setPlayerKey((k) => k + 1);
      } catch {
        // silent fail: brak networku nie ma wywracać UI
      }
    };

    tick();
    const t = setInterval(tick, 500);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [backendBase, isPlaying]);

  const handleEnded = () => {
    setIsPlaying(false);
    setPlayingSrc(null);
    setPlayingId(null);
  };

  return (
    <div className={styles.player}>
      <div className={styles.topBar}>
        aktualny videoID: {apiVideoId === null ? "null" : String(apiVideoId)}
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
            controls={false}
            onEnded={handleEnded}
          />
        ) : (
          <div className={styles.placeholder}>wybierz wideo do odtworzenia</div>
        )}
      </div>
    </div>
  );
}
