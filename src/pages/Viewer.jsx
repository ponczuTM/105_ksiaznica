// Viewer.jsx
import { useEffect, useMemo, useState } from "react";
import styles from "./Viewer.module.css";

import kopernikPhoto from "../assets/images/kopernik.png";
import mapPhoto from "../assets/images/mapa.png";

// THUMBS dla przycisków:
import torunThumb from "../assets/images/torun.png";
import bookThumb from "../assets/images/book.png";
import planetsThumb from "../assets/images/planets.png";

import backButton from "../assets/images/undo-stroke.svg";
import playButton from "../assets/images/play-circle.svg";
import stopButton from "../assets/images/pause-circle.svg";

import { BiUndo, BiPlayCircle, BiPauseCircle } from "react-icons/bi";

import SpaceBackground from "./SpaceBackground";

const ITEMS = [
  { key: "1", label: "TORUŃ - MY TOWN", thumb: torunThumb },
  { key: "2", label: "MY EDUCATION AND COMPETENCES", thumb: bookThumb },
  {
    key: "3",
    label: 'MY HELIOCENTRIC THEORY "DE REVOLUTIONIBUS ORBIUM COELESTIUM"',
    thumb: planetsThumb,
  },
];

export default function Viewer() {
  const [status, setStatus] = useState("DISCONNECTED");

  const [selectedKey, setSelectedKey] = useState(null);
  const [stopped, setStopped] = useState(false);

  const [controlsVisible, setControlsVisible] = useState(false);

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
        const data = await res.json();

        if (cancelled) return;

        setStatus("CONNECTED");

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

  useEffect(() => {
    if (!selectedKey) {
      setControlsVisible(false);
      return;
    }
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
      setSelectedKey(null);
      setStopped(false);

      await sendControl("back");
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  const selectedItem = selectedKey ? ITEMS.find((x) => x.key === selectedKey) : null;

  return (
    <div className={styles.viewer}>
      {/* TŁO (canvas three.js) */}
      <SpaceBackground className={styles.spaceBg} />

      {/* UI na wierzchu */}
      <div className={styles.content}>
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
                  <img src={it.thumb} alt="" />
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
                  <img src={selectedItem?.thumb} alt="" />
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
                  {stopped ? (
                    <BiPlayCircle className={styles.icon} />
                  ) : (
                    <BiPauseCircle className={styles.icon} />
                  )}

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
