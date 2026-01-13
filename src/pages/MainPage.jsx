import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import styles from "./MainPage.module.css";
import bgImage from "../assets/images/image.png";

function canFullscreen() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
}

async function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen(); // Safari
  if (el.msRequestFullscreen) return el.msRequestFullscreen(); // legacy
}

function exitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
}

function isFullscreenNow() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

export default function MainPage() {
  // =========================
  // FULLSCREEN
  // =========================
  const [fsActive, setFsActive] = useState(() => isFullscreenNow());
  const [fsSupported] = useState(() => canFullscreen());

  const syncFsState = useCallback(() => setFsActive(isFullscreenNow()), []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFsState);
    document.addEventListener("webkitfullscreenchange", syncFsState);
    document.addEventListener("msfullscreenchange", syncFsState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFsState);
      document.removeEventListener("webkitfullscreenchange", syncFsState);
      document.removeEventListener("msfullscreenchange", syncFsState);
    };
  }, [syncFsState]);

  // Wyjście: ESC działa zawsze; dodajemy też Space jako "wyjdź" (na desktopie)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === " " && isFullscreenNow()) {
        e.preventDefault();
        exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const statusText = useMemo(() => {
    if (!fsSupported) return "Twoja przeglądarka nie wspiera Fullscreen API.";
    if (fsActive) return "Fullscreen aktywny. Wyjście: Esc / Spacja.";
    return "Kliknij przycisk, żeby wejść w fullscreen.";
  }, [fsActive, fsSupported]);

  const manualEnter = async () => {
    if (!fsSupported) return;
    try {
      await requestFullscreen();
    } catch {}
  };

  // =========================
  // EDITOR (RND + OŁÓWEK)
  // =========================
  const stageRef = useRef(null);
  const colorInputRef = useRef(null);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const currentStrokeRef = useRef(null);

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [tool, setTool] = useState("select"); // select | pencil
  const [currentColor, setCurrentColor] = useState("#ff2d55");
  const [strokeWidth, setStrokeWidth] = useState(5);

  const [newText, setNewText] = useState("Tekst");
  const [newFontSize, setNewFontSize] = useState(32);

  const [strokes, setStrokes] = useState([]); // {id,color,width,points:[{x,y}]}

  const selectedEl = useMemo(
    () => elements.find((e) => e.id === selectedId) || null,
    [elements, selectedId]
  );

  const getStageRect = () => {
    const el = stageRef.current;
    if (!el) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  const getCenterPos = () => {
    const { width, height } = getStageRect();
    return {
      x: Math.max(10, Math.round(width / 2 - 80)),
      y: Math.max(10, Math.round(height / 2 - 60)),
    };
  };

  const addRect = (filled) => {
    const { x, y } = getCenterPos();
    const el = {
      id: Date.now(),
      type: "shape",
      shape: "rect",
      filled,
      color: currentColor,
      strokeWidth: Math.max(1, Number(strokeWidth) || 1),
      width: 180,
      height: 120,
      x,
      y,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool("select");
  };

  const addCircle = (filled) => {
    const { x, y } = getCenterPos();
    const el = {
      id: Date.now(),
      type: "shape",
      shape: "circle",
      filled,
      color: currentColor,
      strokeWidth: Math.max(1, Number(strokeWidth) || 1),
      width: 150,
      height: 150,
      x,
      y,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool("select");
  };

  const addText = () => {
    const { x, y } = getCenterPos();
    const el = {
      id: Date.now(),
      type: "text",
      content: newText.trim() ? newText : "Tekst",
      color: currentColor,
      fontSize: Math.max(1, Number(newFontSize) || 32),
      width: 340,
      height: 70,
      x: Math.max(10, x - 90),
      y,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool("select");
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedEl) return;
    const dup = { ...selectedEl, id: Date.now(), x: selectedEl.x + 20, y: selectedEl.y + 20 };
    setElements((prev) => [...prev, dup]);
    setSelectedId(dup.id);
  };

  const updateSelected = (patch) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
  };

  // Odznaczanie tylko gdy klik w tło (a nie w obiekty) — używamy CAPTURE żeby Rnd mógł stopPropagation
  const onStagePointerDownCapture = (e) => {
    if (tool !== "select") return;
    if (e.target === stageRef.current) setSelectedId(null);
  };

  // =========================
  // CANVAS: resize + redraw
  // =========================
  const redrawAllStrokes = useCallback(
    (ctx) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const s of strokes) {
        if (!s.points || s.points.length < 2) continue;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;

        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
    },
    [strokes]
  );

  const resizeCanvasToStage = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = stage.getBoundingClientRect();

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${Math.floor(width)}px`;
    canvas.style.height = `${Math.floor(height)}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redrawAllStrokes(ctx);
  }, [redrawAllStrokes]);

  useEffect(() => {
    resizeCanvasToStage();
    window.addEventListener("resize", resizeCanvasToStage);
    return () => window.removeEventListener("resize", resizeCanvasToStage);
  }, [resizeCanvasToStage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    redrawAllStrokes(ctx);
  }, [strokes, redrawAllStrokes]);

  // =========================
  // PENCIL: pointer handling (TOUCH PERFECT)
  // =========================
  const getLocalPoint = (evt) => {
    const { left, top } = getStageRect();
    return { x: evt.clientX - left, y: evt.clientY - top };
  };

  const beginStroke = (evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // tylko jeden pointer naraz (palec / rysik)
    drawingRef.current = true;
    activePointerIdRef.current = evt.pointerId;

    const p = getLocalPoint(evt);
    const stroke = {
      id: Date.now(),
      color: currentColor,
      width: Math.max(1, Number(strokeWidth) || 1),
      points: [p],
    };
    currentStrokeRef.current = stroke;

    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);

    // pointer capture MUST na mobile
    try {
      canvas.setPointerCapture(evt.pointerId);
    } catch {}
  };

  const extendStroke = (evt) => {
    if (!drawingRef.current) return;
    if (activePointerIdRef.current !== evt.pointerId) return;

    const stroke = currentStrokeRef.current;
    if (!stroke) return;

    const p = getLocalPoint(evt);
    stroke.points.push(p);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const commitStroke = () => {
    if (!drawingRef.current) return;

    drawingRef.current = false;
    activePointerIdRef.current = null;

    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (!stroke || stroke.points.length < 2) return;
    setStrokes((prev) => [...prev, stroke]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // klucz: passive: false, bo inaczej preventDefault nic nie robi na touch
    const opts = { passive: false };

    const onPointerDown = (e) => {
      if (tool !== "pencil") return;
      e.preventDefault();
      e.stopPropagation();
      beginStroke(e);
    };

    const onPointerMove = (e) => {
      if (tool !== "pencil") return;
      if (!drawingRef.current) return;
      e.preventDefault();
      extendStroke(e);
    };

    const onPointerUp = (e) => {
      if (tool !== "pencil") return;
      e.preventDefault();
      commitStroke();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerCancel = (e) => {
      if (tool !== "pencil") return;
      commitStroke();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onLostPointerCapture = () => {
      // przeglądarka potrafi zgubić capture — kończymy stroke bez "ucinanek"
      if (tool !== "pencil") return;
      commitStroke();
    };

    canvas.addEventListener("pointerdown", onPointerDown, opts);
    canvas.addEventListener("pointermove", onPointerMove, opts);
    canvas.addEventListener("pointerup", onPointerUp, opts);
    canvas.addEventListener("pointercancel", onPointerCancel, opts);
    canvas.addEventListener("lostpointercapture", onLostPointerCapture, opts);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown, opts);
      canvas.removeEventListener("pointermove", onPointerMove, opts);
      canvas.removeEventListener("pointerup", onPointerUp, opts);
      canvas.removeEventListener("pointercancel", onPointerCancel, opts);
      canvas.removeEventListener("lostpointercapture", onLostPointerCapture, opts);
    };
  }, [tool, currentColor, strokeWidth]);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>MainPage</div>

        <div className={styles.actions}>
          {!fsActive && fsSupported && (
            <button className={styles.primaryBtn} onClick={manualEnter}>
              Wejdź w fullscreen
            </button>
          )}
          <span className={styles.pill}>{statusText}</span>
        </div>
      </header>

      <section className={styles.workspace}>
        {/* PANEL */}
        <aside className={styles.panel}>
          <div className={styles.panelTitle}>Narzędzia</div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Tryb</div>
            <div className={styles.btnRow}>
              <button
                className={tool === "select" ? styles.btnPrimary : styles.btn}
                onClick={() => setTool("select")}
                type="button"
              >
                Selekcja
              </button>
              <button
                className={tool === "pencil" ? styles.btnPrimary : styles.btn}
                onClick={() => {
                  setSelectedId(null);
                  setTool("pencil");
                }}
                type="button"
              >
                Ołówek
              </button>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Kolor</div>

            <button
              className={styles.colorBtn}
              style={{ background: currentColor }}
              onClick={() => colorInputRef.current?.click()}
              type="button"
            >
              Wybierz kolor
            </button>

            <input
              ref={colorInputRef}
              className={styles.hiddenColor}
              type="color"
              value={currentColor}
              onChange={(e) => {
                const c = e.target.value;
                setCurrentColor(c);
                if (selectedId) updateSelected({ color: c });
              }}
            />

            <div className={styles.row}>
              <span className={styles.rowLabel}>Grubość:</span>
              <input
                className={styles.range}
                type="range"
                min={1}
                max={24}
                value={strokeWidth}
                onChange={(e) => {
                  const v = Number(e.target.value) || 1;
                  setStrokeWidth(v);
                  if (selectedId) updateSelected({ strokeWidth: v });
                }}
              />
              <span className={styles.rowValue}>{strokeWidth}</span>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Prostokąt</div>
            <div className={styles.btnRow}>
              <button className={styles.btn} onClick={() => addRect(false)} type="button">
                Bez wypełnienia
              </button>
              <button className={styles.btn} onClick={() => addRect(true)} type="button">
                Z wypełnieniem
              </button>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Koło</div>
            <div className={styles.btnRow}>
              <button className={styles.btn} onClick={() => addCircle(false)} type="button">
                Bez wypełnienia
              </button>
              <button className={styles.btn} onClick={() => addCircle(true)} type="button">
                Z wypełnieniem
              </button>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Tekst</div>
            <input className={styles.input} value={newText} onChange={(e) => setNewText(e.target.value)} />
            <input
              className={styles.input}
              type="number"
              min={1}
              value={newFontSize}
              onChange={(e) => setNewFontSize(e.target.value)}
            />
            <button className={styles.btnPrimary} onClick={addText} type="button">
              Dodaj tekst
            </button>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Zaznaczenie</div>

            <div className={styles.selectedBox}>
              {selectedEl ? (
                <>
                  <div className={styles.selectedLine}>
                    <span className={styles.muted}>Typ:</span>{" "}
                    {selectedEl.type === "text"
                      ? "Tekst"
                      : selectedEl.shape === "circle"
                      ? selectedEl.filled
                        ? "Koło (fill)"
                        : "Koło (outline)"
                      : selectedEl.filled
                      ? "Prostokąt (fill)"
                      : "Prostokąt (outline)"}
                  </div>
                  <div className={styles.selectedLine}>
                    <span className={styles.muted}>ID:</span> {selectedEl.id}
                  </div>
                </>
              ) : (
                <div className={styles.muted}>Brak zaznaczenia</div>
              )}
            </div>

            <div className={styles.btnRow}>
              <button className={styles.btn} onClick={duplicateSelected} disabled={!selectedEl} type="button">
                Duplikuj
              </button>
              <button className={styles.btnDanger} onClick={deleteSelected} disabled={!selectedEl} type="button">
                Usuń
              </button>
            </div>
          </div>

          {selectedEl?.type === "text" && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Edycja tekstu</div>
              <input
                className={styles.input}
                value={selectedEl.content}
                onChange={(e) => updateSelected({ content: e.target.value })}
              />
              <input
                className={styles.input}
                type="number"
                min={1}
                value={selectedEl.fontSize}
                onChange={(e) => updateSelected({ fontSize: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          )}
        </aside>

        {/* STAGE */}
        <div
          className={styles.stage}
          ref={stageRef}
          onPointerDownCapture={onStagePointerDownCapture}
          style={{ backgroundImage: `url(${bgImage})` }}
        >
          <div className={styles.stageOverlay} />

          {/* CANVAS: w pencil łapie gesty, w select ignoruje */}
          <canvas
            ref={canvasRef}
            className={`${styles.drawCanvas} ${tool === "pencil" ? styles.canvasActive : ""}`}
            aria-hidden="true"
          />

          {/* RND: zawsze nad canvasem */}
          {elements.map((el) => {
            const isSelected = el.id === selectedId;

            return (
              <Rnd
                key={el.id}
                size={{ width: el.width, height: el.height }}
                position={{ x: el.x, y: el.y }}
                bounds="parent"
                disableDragging={tool !== "select"}
                enableResizing={tool === "select"}
                onDragStop={(e, d) => {
                  setElements((prev) => prev.map((p) => (p.id === el.id ? { ...p, x: d.x, y: d.y } : p)));
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const newW = parseInt(ref.style.width, 10);
                  const newH = parseInt(ref.style.height, 10);
                  setElements((prev) =>
                    prev.map((p) =>
                      p.id === el.id ? { ...p, width: newW, height: newH, x: position.x, y: position.y } : p
                    )
                  );
                }}
                onPointerDown={(e) => {
                  // selekcja ma działać zawsze w select
                  if (tool !== "select") return;
                  e.stopPropagation();
                  setSelectedId(el.id);
                }}
                className={isSelected ? styles.rndSelected : styles.rnd}
              >
                {el.type === "text" ? (
                  <div
                    className={styles.textBox}
                    style={{
                      color: el.color,
                      fontSize: el.fontSize,
                    }}
                    onPointerDown={(e) => tool === "select" && e.stopPropagation()}
                  >
                    {el.content}
                  </div>
                ) : (
                  <div
                    className={styles.shape}
                    style={{
                      borderRadius: el.shape === "circle" ? "50%" : "10px",
                      backgroundColor: el.filled ? el.color : "transparent",
                      border: el.filled ? "none" : `${el.strokeWidth || 3}px solid ${el.color}`,
                    }}
                    onPointerDown={(e) => tool === "select" && e.stopPropagation()}
                  />
                )}

                {isSelected && tool === "select" && (
                  <>
                    <span className={styles.handle} style={{ top: "-7px", left: "-7px" }} />
                    <span className={styles.handle} style={{ top: "-7px", right: "-7px" }} />
                    <span className={styles.handle} style={{ bottom: "-7px", left: "-7px" }} />
                    <span className={styles.handle} style={{ bottom: "-7px", right: "-7px" }} />
                    <span className={styles.handle} style={{ top: "-8px", left: "50%", transform: "translateX(-50%)" }} />
                    <span
                      className={styles.handle}
                      style={{ bottom: "-8px", left: "50%", transform: "translateX(-50%)" }}
                    />
                    <span className={styles.handle} style={{ top: "50%", left: "-8px", transform: "translateY(-50%)" }} />
                    <span className={styles.handle} style={{ top: "50%", right: "-8px", transform: "translateY(-50%)" }} />
                  </>
                )}
              </Rnd>
            );
          })}
        </div>
      </section>
    </main>
  );
}
