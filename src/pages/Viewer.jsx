// Viewer.jsx
import { useEffect, useMemo, useState } from "react";
import styles from "./Viewer.module.css";

import kopernikPhoto from "../assets/images/kopernik.png";
import mapPhoto from "../assets/images/mapa.png";
import planetsPhoto from "../assets/images/planets.png";

// Twoje SVG (BACK/PLAY/STOP) – użyte jako fallback / opcjonalnie
import backButton from "../assets/images/undo-stroke.svg";
import playButton from "../assets/images/play-circle.svg";
import stopButton from "../assets/images/pause-circle.svg";

// Boxicons via react-icons
import { BiUndo, BiPlayCircle, BiPauseCircle } from "react-icons/bi";

const ITEMS = [
  { key: "1", label: "Do you know when and where Nicolaus Copernicus was born?" },
  {
    key: "2",
    label:
      "Do you know what was the most important discovery of Copernicus concerning the structure of the Solar System?",
  },
  {
    key: "3",
    label: "Do you know what studies Copernicus completed and which fields of knowledge he explored?",
  },
];

export default function Viewer() {
  const [status, setStatus] = useState("DISCONNECTED");

  // UI state
  const [selectedKey, setSelectedKey] = useState(null);
  const [stopped, setStopped] = useState(false);

  // animacje: sterujemy klasą "enter"
  const [controlsVisible, setControlsVisible] = useState(false);

  const backendBase = useMemo(() => {
    const localip = import.meta.env.VITE_BACKEND_IP;
    const port = import.meta.env.VITE_BACKEND_PORT;
    return `http://${localip}:${port}`;
  }, []);

  // Poll backend: status + auto-reset UI when backend says videoid=null
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const res = await fetch(`${backendBase}/get`, { cache: "no-store" });
        if (!res.ok) throw new Error("Bad status");
        const data = await res.json();

        if (cancelled) return;

        setStatus("CONNECTED");

        // Jeśli wideo skończyło się i backend ma null -> Viewer wraca do domyślnego
        const backendVideoId = data?.videoid ?? null;
        if (backendVideoId === null && selectedKey !== null) {
          setSelectedKey(null);
          setStopped(false);
        }
      } catch {
        if (!cancelled) setStatus("ERROR");
      }
    };

    ping();
    const t = setInterval(ping, 1000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [backendBase, selectedKey]);

  // kontrolki mają się ładnie pojawić po wybraniu kafla
  useEffect(() => {
    if (!selectedKey) {
      setControlsVisible(false);
      return;
    }
    // mikro-opóźnienie => CSS animacje startują pewniej
    const t = setTimeout(() => setControlsVisible(true), 20);
    return () => clearTimeout(t);
  }, [selectedKey]);

  const connected = status === "CONNECTED";

  const sendSelection = async (itemKey) => {
    const url = `${backendBase}/post/${itemKey}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error("POST failed");
  };

  const sendControl = async (action) => {
    const url = `${backendBase}/control/${action}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error("CONTROL failed");
  };

  const onPick = async (key) => {
    try {
      setSelectedKey(key);
      setStopped(false);
      await sendSelection(key);
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  const onStopPlay = async () => {
    if (!selectedKey) return;

    try {
      if (!stopped) {
        setStopped(true);
        await sendControl("stop");
      } else {
        setStopped(false);
        await sendControl("play");
      }
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  const onBack = async () => {
    try {
      // UI lokalnie od razu w domyślny
      setSelectedKey(null);
      setStopped(false);

      // Backend OBLIGATORYJNIE null
      await sendControl("back");
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
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
              <button
                key={selectedItem?.key}
                disabled
                className={[
                  styles.qButton,
                  styles.qButtonSelected,
                  styles.qButtonSelectedEnter,
                ].join(" ")}
              >
                <span className={styles.qThumb} aria-hidden="true">
                  <img src={planetsPhoto} alt="" />
                </span>
                <span className={styles.qText}>{selectedItem?.label}</span>
              </button>

              <div
                className={[
                  styles.controls,
                  controlsVisible ? styles.controlsEnter : "",
                ].join(" ")}
              >
                <button
                  onClick={onStopPlay}
                  disabled={!connected}
                  className={styles.iconBtn}
                  aria-label={stopped ? "Play" : "Stop"}
                  title={stopped ? "PLAY" : "STOP"}
                >
                  {/* Boxicons */}
                  {stopped ? (
                    <BiPlayCircle className={styles.icon} />
                  ) : (
                    <BiPauseCircle className={styles.icon} />
                  )}

                  {/* Fallback Twoje SVG (możesz usunąć) */}
                  <img
                    className={styles.iconFallback}
                    src={stopped ? playButton : stopButton}
                    alt=""
                    aria-hidden="true"
                  />
                </button>

                <button
                  onClick={onBack}
                  disabled={!connected}
                  className={[styles.iconBtn, styles.iconBtnSecondary].join(" ")}
                  aria-label="Back"
                  title="BACK"
                >
                  <BiUndo className={styles.icon} />
                  <img
                    className={styles.iconFallback}
                    src={backButton}
                    alt=""
                    aria-hidden="true"
                  />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
