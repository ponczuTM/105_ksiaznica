import React, { useEffect, useState, useRef } from "react";
import styles from "./Robot.module.css";

import videoXX from "../assets/videos/1_cz_logo.mp4";
import video05 from "../assets/videos/2_cz_podejdz.mp4";
import videoAB from "../assets/videos/3_cz_robot.mp4";

const Robot = () => {
  const [distance, setDistance] = useState("Loading...");
  const [isBlocked, setIsBlocked] = useState(false);
  const [canReactToChange, setCanReactToChange] = useState(true);
  const [ignoreChanges, setIgnoreChanges] = useState(false);
  const [videoSource, setVideoSource] = useState(videoXX);
  const videoRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (!isBlocked && canReactToChange && !ignoreChanges) {
        if (["AB", "01", "02", "03", "04"].includes(data.distance)) {
          setDistance("AB");
          setIsBlocked(true);
        } else {
          setDistance(data.distance);
        }
      }
    };

    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [isBlocked, canReactToChange, ignoreChanges]);

  const handleVideoEnd = () => {
    setIsBlocked(false);
    setIgnoreChanges(true);
    setDistance("XX");
    setTimeout(() => {
      setIgnoreChanges(false);
    }, 5000);
  };

  const handleVideoStart = () => {
    setCanReactToChange(false);
    setTimeout(() => {
      setCanReactToChange(true);
    }, 5000);
  };

  useEffect(() => {
    if (distance === "XX") {
      setVideoSource(videoXX);
    } else if (["05", "06", "07"].includes(distance)) {
      setVideoSource(video05);
    } else if (["01", "02", "AB", "03", "04"].includes(distance)) {
      setVideoSource(videoAB);
    }
  }, [distance]);

  return (
    <div className={styles.videoContainer}>
      <video
        ref={videoRef}
        src={videoSource}
        preload="auto"
        autoPlay
        loop={["XX", "05", "06", "07"].includes(distance)}
        muted={distance === "XX"}
        onPlay={handleVideoStart}
        onEnded={handleVideoEnd}
        className={styles.video}
      />
      {["XX", "05", "06", "07"].includes(distance) && (
        <div className={styles.message}>PODEJDŹ BLIŻEJ</div>
      )}
    </div>
  );
};

export default Robot;
