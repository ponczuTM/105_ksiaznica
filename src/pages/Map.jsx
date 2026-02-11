import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Map.module.css";
import photo from "../assets/images/carousel.png";

export default function Map() {
  // px/s (zmień jak chcesz)
  const SPEED = 120;

  // kierunek w osi X i Y: -1 / 0 / 1
  const [vx, setVx] = useState(-1); // start: w lewo
  const [vy, setVy] = useState(0);

  const trackRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 }); // aktualny przesuw w px
  const lastTsRef = useRef(null);
  const rafRef = useRef(null);

  // liczba kafli (im więcej, tym większa "płachta")
  const TILE_COUNT = 4;

  // budujemy siatkę TILE_COUNT x TILE_COUNT
  const tiles = useMemo(() => {
    const arr = [];
    for (let r = 0; r < TILE_COUNT; r++) {
      for (let c = 0; c < TILE_COUNT; c++) {
        arr.push({ id: `${r}-${c}`, src: photo });
      }
    }
    return arr;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const normalize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      let { x, y } = offsetRef.current;

      // trzymamy x w [-w, 0) i y w [-h, 0)
      if (w > 0) {
        x = ((x % w) + w) % w; // [0,w)
        x = x - w; // [-w,0)
      }
      if (h > 0) {
        y = ((y % h) + h) % h; // [0,h)
        y = y - h; // [-h,0)
      }

      offsetRef.current = { x, y };
      track.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const tick = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const w = window.innerWidth;
      const h = window.innerHeight;

      let { x, y } = offsetRef.current;

      x += vx * SPEED * dt;
      y += vy * SPEED * dt;

      // zapętlenie w osi X
      if (x <= -w) x += w;
      if (x >= 0) x -= w;

      // zapętlenie w osi Y
      if (y <= -h) y += h;
      if (y >= 0) y -= h;

      offsetRef.current = { x, y };
      track.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const onResize = () => normalize();
    window.addEventListener("resize", onResize);

    // ustaw od razu poprawny zakres
    normalize();

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [vx, vy]);

  // proste sterowanie: strzałka ustawia ruch tylko w tej osi (bez skosu)
  const goLeft = () => {
    setVx(-1);
    setVy(0);
  };
  const goRight = () => {
    setVx(1);
    setVy(0);
  };
  const goUp = () => {
    setVx(0);
    setVy(-1);
  };
  const goDown = () => {
    setVx(0);
    setVy(1);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.viewport}>
        <div ref={trackRef} className={styles.track}>
          {tiles.map((t) => (
            <div className={styles.tile} key={t.id}>
              <img className={styles.image} src={t.src} alt={`bg-${t.id}`} />
            </div>
          ))}
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={goLeft}
            aria-label="Ruch w lewo"
            title="W lewo"
          >
            ←
          </button>

          <div className={styles.vert}>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={goUp}
              aria-label="Ruch w górę"
              title="W górę"
            >
              ↑
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={goDown}
              aria-label="Ruch w dół"
              title="W dół"
            >
              ↓
            </button>
          </div>

          <button
            type="button"
            className={styles.arrowBtn}
            onClick={goRight}
            aria-label="Ruch w prawo"
            title="W prawo"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
