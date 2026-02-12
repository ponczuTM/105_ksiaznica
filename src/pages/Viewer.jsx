// Viewer.jsx
import { useEffect, useMemo, useState } from "react";
import styles from "./Viewer.module.css";

import kopernikPhoto from "../assets/images/kopernik.png";
import mapPhoto from "../assets/images/mapa.png";
import planetsPhoto from "../assets/images/planets.png";

const ITEMS = [
  { key: "1", label: "Do you know when and where Nicolaus Copernicus was born?" },
  { key: "2", label: "Do you know what was the most important discovery of Copernicus concerning the structure of the Solar System?" },
  { key: "3", label: "Do you know what studies Copernicus completed and which fields of knowledge he explored?" },
  { key: "4", label: "Do you know the title of Copernicus's work in which he presented his heliocentric theory?" },
  { key: "5", label: "Do you know where Copernicus's tomb is located today?" },
  { key: "6", label: "Do you know the name of the most famous astronomer born in Toruń?" },
  { key: "7", label: "Do you know what traditional product is Toruń famous for, with a dedicated museum in the city?" },
  { key: "8", label: "Do you know which river flows through Toruń?" },
  { key: "9", label: "Do you know the name of the famous leaning structure in Toruń's Old Town?" },
  { key: "10", label: "Do you know the name of the Toruń Old Town complex listed as a UNESCO World Heritage Site?" },
];

export default function Viewer() {
  const [status, setStatus] = useState("DISCONNECTED");

  // UI state
  const [selectedKey, setSelectedKey] = useState(null); // wybrany temat
  const [stopped, setStopped] = useState(false); // STOP/PLAY toggle

  const backendBase = useMemo(() => {
    const localip = import.meta.env.VITE_BACKEND_IP;
    const port = import.meta.env.VITE_BACKEND_PORT;
    return `http://${localip}:${port}`;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
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

  const connected = status === "CONNECTED";

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

  const sendControl = async (action) => {
    // action: "stop" | "play" | "back"
    try {
      const url = `${backendBase}/control/${action}`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("CONTROL failed");
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  const onPick = async (key) => {
    setSelectedKey(key);
    setStopped(false);
    await sendSelection(key);
  };

  const onStopPlay = async () => {
    if (!selectedKey) return;

    if (!stopped) {
      // STOP
      setStopped(true);
      await sendControl("stop");
    } else {
      // PLAY
      setStopped(false);
      await sendControl("play");
    }
  };

  const onBack = async () => {
    // BACK musi OBLIGATORYJNIE ustawić null i przywrócić Player do placeholdera
    setSelectedKey(null);
    setStopped(false);
    await sendControl("back");
  };

  const selectedItem = selectedKey ? ITEMS.find((x) => x.key === selectedKey) : null;

  return (
    <div className={styles.viewer}>
      <div className={styles.content}>
        {/* TOP BANNER */}
        <div className={styles.banner}>
          <div className={styles.bannerInner}>
            <div className={styles.bannerLeftImg}>
              <img src={kopernikPhoto} alt="Nicolaus Copernicus" />
            </div>

            <div className={styles.bannerCenter}>
              <div className={styles.bannerTitle}>NICOLAUS COPERNICUS</div>
              <div className={styles.bannerYears}>1473–1543</div>
            </div>

            <div className={styles.bannerRightImg}>
              <img src={mapPhoto} alt="Map / diagram" />
            </div>
          </div>

          {/* STATUS pill */}
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
        </div>

        {/* QUESTIONS / SELECTED VIEW */}
        <section className={styles.questions}>
          {!selectedKey ? (
            ITEMS.map((it) => (
              <button
                key={it.key}
                onClick={() => onPick(it.key)}
                disabled={!connected}
                className={styles.qButton}
              >
                <span className={styles.qThumb} aria-hidden="true">
                  <img src={planetsPhoto} alt="" />
                </span>
                <span className={styles.qText}>{it.label}</span>
              </button>
            ))
          ) : (
            <>
              {/* Pokazujemy TYLKO wybrany temat */}
              <button
                key={selectedItem?.key}
                disabled
                className={[styles.qButton, styles.qButtonSelected].join(" ")}
              >
                <span className={styles.qThumb} aria-hidden="true">
                  <img src={planetsPhoto} alt="" />
                </span>
                <span className={styles.qText}>{selectedItem?.label}</span>
              </button>

              {/* Panel sterowania */}
              <div className={styles.controls}>
                <button
                  onClick={onStopPlay}
                  disabled={!connected}
                  className={styles.controlBtn}
                >
                  {stopped ? "PLAY" : "STOP"}
                </button>

                <button
                  onClick={onBack}
                  disabled={!connected}
                  className={styles.controlBtnSecondary}
                >
                  BACK
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
