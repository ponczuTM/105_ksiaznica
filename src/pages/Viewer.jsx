import { useEffect, useMemo, useRef, useState } from "react";
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
  const wsRef = useRef(null);
  const [status, setStatus] = useState("DISCONNECTED");

  const wsUrl = useMemo(() => {
    const base = import.meta.env.VITE_WS_URL;
    return `${base}?role=viewer`;
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("CONNECTED");
    ws.onerror = () => setStatus("ERROR");
    ws.onclose = () => setStatus("DISCONNECTED");
    ws.onmessage = (evt) => console.log("WS message", evt.data);

    return () => {
      try { ws.close(); } catch {}
    };
  }, [wsUrl]);

  const sendSelection = (itemKey) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: "selection", item: itemKey, ts: Date.now() }));
  };

  return (
    <div className={styles.viewer}>
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
