// Viewer.jsx
import { useEffect, useMemo, useState } from "react";
import styles from "./Viewer.module.css";

import kopernikPhoto from "../assets/images/kopernik.png";
import mapPhoto from "../assets/images/mapa.png";

import bookThumb from "../assets/images/book.png";
import planetsThumb from "../assets/images/planets.png";
import torunThumb from "../assets/images/torun.png";

import stopButton from "../assets/images/pause-circle.svg";
import playButton from "../assets/images/play-circle.svg";
import backButton from "../assets/images/undo-stroke.svg";

import { BiPauseCircle, BiPlayCircle, BiUndo } from "react-icons/bi";

import SpaceBackground from "./SpaceBackground";

import video1 from "../assets/images/video_played_1_optimized_compressed.mp4";
import video2 from "../assets/images/video_played_2_optimized_compressed.mp4";
import video3 from "../assets/images/video_played_3_optimized_compressed.mp4";

const ITEMS_EN = [
  { key: "1", label: "ORIGIN TOWN - TORUŃ", thumb: torunThumb },
  { key: "2", label: "EDUCATION AND COMPETENCES", thumb: bookThumb },
  { key: "3", label: "HELIOCENTRIC THEORY", thumb: planetsThumb },
];

const ITEMS_PL = [
  { key: "1", label: "MIASTO POCHODZENIA - TORUŃ", thumb: torunThumb },
  { key: "2", label: "EDUKACJA I KOMPETENCJE", thumb: bookThumb },
  { key: "3", label: "TEORIA HELIOCENTRYCZNA", thumb: planetsThumb },
];

const VIDEO_MAP = {
  "1": video1,
  "2": video2,
  "3": video3,
};

const BACKEND_ID_PL = {
  "1": "5",
  "2": "6",
  "3": "7",
};

function LabelWithNewlines({ text }) {
  if (typeof text !== "string") return null;
  return text.split("\\n").map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </span>
  ));
}

export default function Viewer() {
  const [status, setStatus] = useState("DISCONNECTED");
  const [selectedKey, setSelectedKey] = useState(null);
  const [stopped, setStopped] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [lang, setLang] = useState("EN");
  const [robotMode, setRobotMode] = useState(false);
  const [showPlanetsInBackground, setShowPlanetsInBackground] = useState(true);

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

  const sendSelection = async (uiKey) => {
    const backendId = lang === "PL" ? BACKEND_ID_PL[uiKey] : uiKey;
    const url = `${backendBase}/post/${backendId}`;
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

  // --- ROBOT ---
  const onRobotEnter = async () => {
    try {
      setRobotMode(true);
      setSelectedKey(null);
      setStopped(false);
      setShowPlanetsInBackground(false);
      await sendControl("robot");
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  const onRobotBack = async () => {
    try {
      setRobotMode(false);
      setShowPlanetsInBackground(true);
      await sendControl("robot-off");
      setStatus("CONNECTED");
    } catch {
      setStatus("ERROR");
    }
  };

  const ITEMS = lang === "PL" ? ITEMS_PL : ITEMS_EN;
  const selectedItem = selectedKey ? ITEMS.find((x) => x.key === selectedKey) : null;
  const selectedVideo = selectedKey ? VIDEO_MAP[selectedKey] : null;
  const isPlayingView = Boolean(selectedVideo);

  return (
    <div className={styles.viewer}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
        aria-hidden="true"
        className={styles.svgFilters}
      >
        <filter
          id="glass-distortion"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.001 0.005"
            numOctaves="1"
            seed="17"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feSpecularLighting
            in="softMap"
            surfaceScale="5"
            specularConstant="1"
            specularExponent="100"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="200"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {showPlanetsInBackground && <SpaceBackground className={styles.spaceBg} />}

      {/* Przełącznik języka — ukryty w trybie robota */}
      {!robotMode && (
        <div className={styles.langSwitch}>
          <button
            type="button"
            onClick={() => setLang("PL")}
            className={[
              styles.langBtn,
              styles.liquidGlass,
              lang === "PL" ? styles.langBtnActive : "",
            ].join(" ")}
            aria-pressed={lang === "PL"}
          >
            POLSKI
          </button>

          <button
            type="button"
            onClick={() => setLang("EN")}
            className={[
              styles.langBtn,
              styles.liquidGlass,
              lang === "EN" ? styles.langBtnActive : "",
            ].join(" ")}
            aria-pressed={lang === "EN"}
          >
            ENGLISH
          </button>
        </div>
      )}

      {/* Przycisk ROBOT — lewy dolny róg, ukryty gdy już w trybie robota */}
      {!robotMode && (
        <button
          type="button"
          onClick={onRobotEnter}
          disabled={!connected}
          className={[styles.robotBtn, styles.liquidGlass].join(" ")}
          aria-label="Tryb robota"
          title="ROBOT"
        >
          🤖
        </button>
      )}

      <div className={styles.content}>
        {/* Banner — ukryty w trybie robota i podczas odtwarzania */}
        {!isPlayingView && !robotMode && (
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
        )}

        <section className={styles.questions}>
          {/* TRYB ROBOTA */}
          {robotMode ? (
            <div className={styles.robotMode}>
              <button
                onClick={onRobotBack}
                disabled={!connected}
                className={[
                  styles.iconBtn,
                  styles.liquidGlass,
                  styles.iconBtnSecondary,
                ].join(" ")}
                aria-label="Powrót"
                title="POWRÓT"
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
          ) : !selectedKey ? (
            ITEMS.map((it) => (
              <button
                key={it.key}
                onClick={() => onPick(it.key)}
                disabled={!connected}
                className={[styles.qButton, styles.liquidGlass].join(" ")}
              >
                <span className={styles.qThumb} aria-hidden="true">
                  <img src={it.thumb} alt="" />
                </span>

                <span className={styles.qText}>
                  <LabelWithNewlines text={it.label} />
                </span>
              </button>
            ))
          ) : (
            <>
              <button
                key={selectedItem?.key}
                disabled
                className={[
                  styles.qButton,
                  styles.liquidGlass,
                  styles.qButtonSelected,
                  styles.qButtonSelectedEnter,
                ].join(" ")}
              >
                <span className={styles.qThumb} aria-hidden="true">
                  <img src={selectedItem?.thumb} alt="" />
                </span>

                <span className={styles.qText}>
                  <LabelWithNewlines text={selectedItem?.label ?? ""} />
                </span>
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
                  className={[styles.iconBtn, styles.liquidGlass].join(" ")}
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
                  className={[
                    styles.iconBtn,
                    styles.liquidGlass,
                    styles.iconBtnSecondary,
                  ].join(" ")}
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

              {selectedVideo && (
                <div className={[styles.playedMedia, styles.liquidGlass].join(" ")}>
                  <video
                    className={styles.playedVideo}
                    src={selectedVideo}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}