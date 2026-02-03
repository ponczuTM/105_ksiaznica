// Viewer.jsx
import { useEffect, useMemo, useState } from "react";
import styles from "./Viewer.module.css";
import BGvideo from "../assets/images/video.mp4";

const ITEMS = [
  { key: "1", label: "Do you know when and where Nicolaus Copernicus was born?" },
  { key: "2", label: "Do you know what was the most important discovery of Copernicus concerning the structure of the Solar System?" },
  { key: "3", label: "Do you know what studies Copernicus completed and which fields of knowledge he explored?" },
  { key: "4", label: "Do you know the title of Copernicus’s work in which he presented his heliocentric theory?" },
  { key: "5", label: "Do you know where Copernicus's tomb is located today?" },
  { key: "6", label: "Do you know the name of the most famous astronomer born in Toruń?" },
  { key: "7", label: "Do you know what traditional product is Toruń famous for, with a dedicated museum in the city?" },
  { key: "8", label: "Do you know which river flows through Toruń?" },
  { key: "9", label: "Do you know the name of the famous leaning structure in Toruń’s Old Town?" },
  { key: "10", label: "Do you know the name of the Toruń Old Town complex listed as a UNESCO World Heritage Site?" }
];

export default function Viewer() {
  const [status, setStatus] = useState("DISCONNECTED");

  // backend stoi na player/serwerze
  const backendBase = useMemo(() => {
    const localip = "10.10.233.138";
    const port = 3001;
    return `http://${localip}:${port}`;
  }, []);

  // ping backendu
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const res = await fetch(`${backendBase}/get`);
        if (!res.ok) throw new Error("Bad status");
        if (!cancelled) setStatus("CONNECTED");
      } catch {
        if (!cancelled) setStatus("ERROR");
      }
    };

    ping();
    const t = setInterval(ping, 2000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [backendBase]);

  const sendSelection = async (itemKey) => {
    try {
      const url = `${backendBase}/post/${itemKey}`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("POST failed");
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  return (
    <div className={styles.viewer}>
      {/* VIDEO BACKGROUND */}
      <video
        className={styles.bgVideo}
        src={BGvideo}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* opcjonalna warstwa przyciemniająca */}
      <div className={styles.bgOverlay} />

      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Ask Nicolaus Copernicus</h1>

          <div className={styles.status}>
            <span
              className={[
                styles.statusDot,
                status === "DISCONNECTED" ? styles.disconnected : "",
                status === "ERROR" ? styles.error : "",
              ].join(" ")}
            />
            <span className={styles.statusText}>{status}</span>
          </div>
        </header>

        <div className={styles.grid}>
          {ITEMS.map((it) => (
            <button
              key={it.key}
              onClick={() => sendSelection(it.key)}
              disabled={status !== "CONNECTED"}
              className={styles.button}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
