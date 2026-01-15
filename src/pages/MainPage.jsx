import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import styles from "./MainPage.module.css";
import bgImage from "../assets/images/image.jpg";

function canFullscreen() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
}

async function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
}

function exitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
}

function isFullscreenNow() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

const DEFAULT_SIZE = {
  rect: { w: 180, h: 120 },
  circle: { w: 150, h: 150 },
};

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

  const manualEnter = async () => {
    if (!fsSupported) return;
    try {
      await requestFullscreen();
    } catch {}
  };

  // =========================
  // SLIDE PANEL
  // =========================
  const [panelOpen, setPanelOpen] = useState(false);
  const panelWrapRef = useRef(null);
  const panelToggleRef = useRef(null);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  useEffect(() => {
    if (!panelOpen) return;

    const onPointerDown = (e) => {
      const wrap = panelWrapRef.current;
      const toggle = panelToggleRef.current;

      if (!wrap) return;

      const target = e.target;

      if (toggle && toggle.contains(target)) return;
      if (wrap.contains(target)) return;

      closePanel();
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [panelOpen, closePanel]);

  // =========================
  // EDITOR
  // =========================
  const stageRef = useRef(null);
  const colorInputRef = useRef(null);

  // Pencil canvas
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const currentStrokeRef = useRef(null);

  // 🎯 RAF batching refs
  const rafIdRef = useRef(null);
  const pendingPointRef = useRef(null);

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [tool, setTool] = useState("select");

  const [currentColor, setCurrentColor] = useState("#ff2d55");
  const [strokeWidth, setStrokeWidth] = useState(5);

  const [strokes, setStrokes] = useState([]);

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

  const clampToStage = (x, y, w, h) => {
    const { width, height } = getStageRect();
    const nx = Math.max(0, Math.min(x, Math.max(0, width - w)));
    const ny = Math.max(0, Math.min(y, Math.max(0, height - h)));
    return { x: nx, y: ny };
  };

  // =========================
  // PLACE TOOL
  // =========================
  const createElementAt = (clientX, clientY) => {
    const { left, top } = getStageRect();
    const x0 = clientX - left;
    const y0 = clientY - top;

    const id = Date.now();

    const isRect = tool === "place_rect_fill" || tool === "place_rect_outline";
    const isCircle = tool === "place_circle_fill" || tool === "place_circle_outline";

    if (!isRect && !isCircle) return;

    if (isRect) {
      const { w, h } = DEFAULT_SIZE.rect;
      const pos = clampToStage(x0 - w / 2, y0 - h / 2, w, h);
      const filled = tool === "place_rect_fill";
      const el = {
        id,
        type: "shape",
        shape: "rect",
        filled,
        color: currentColor,
        strokeWidth: Math.max(1, Number(strokeWidth) || 1),
        width: w,
        height: h,
        x: pos.x,
        y: pos.y,
      };
      setElements((prev) => [...prev, el]);
      setSelectedId(id);
      setTool("select");
      return;
    }

    if (isCircle) {
      const { w, h } = DEFAULT_SIZE.circle;
      const pos = clampToStage(x0 - w / 2, y0 - h / 2, w, h);
      const filled = tool === "place_circle_fill";
      const el = {
        id,
        type: "shape",
        shape: "circle",
        filled,
        color: currentColor,
        strokeWidth: Math.max(1, Number(strokeWidth) || 1),
        width: w,
        height: h,
        x: pos.x,
        y: pos.y,
      };
      setElements((prev) => [...prev, el]);
      setSelectedId(id);
      setTool("select");
      return;
    }
  };

  const onStagePointerDownCapture = (e) => {
    if (tool.startsWith("place_")) {
      if (!stageRef.current) return;
      e.preventDefault();
      createElementAt(e.clientX, e.clientY);
      return;
    }

    if (tool === "select") {
      if (e.target === stageRef.current) setSelectedId(null);
    }
  };

  // =========================
  // ELEMENT ACTIONS
  // =========================
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

    // 🎯 Ograniczamy DPR do 2 max dla dużych ekranów
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = stage.getBoundingClientRect();

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${Math.floor(width)}px`;
    canvas.style.height = `${Math.floor(height)}px`;

    const ctx = canvas.getContext("2d", { 
      alpha: true,
      desynchronized: true // 🎯 Optymalizacja dla touch
    });
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
  // PENCIL: RAF BATCHING 🎯
  // =========================
  const getLocalPoint = (evt) => {
    const { left, top } = getStageRect();
    return { x: evt.clientX - left, y: evt.clientY - top };
  };

  const beginStroke = (evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    try {
      canvas.setPointerCapture(evt.pointerId);
    } catch {}
  };

  // 🎯 ZMIENIONO: zamiast bezpośrednio rysować, zapisujemy punkt i planujemy RAF
  const extendStroke = (evt) => {
    if (!drawingRef.current) return;
    if (activePointerIdRef.current !== evt.pointerId) return;

    const stroke = currentStrokeRef.current;
    if (!stroke) return;

    const p = getLocalPoint(evt);
    stroke.points.push(p);

    // Zapisz ostatni punkt do przerysowania
    pendingPointRef.current = p;

    // Jeśli RAF już nie jest zaplanowany, zaplanuj
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;

        const canvas = canvasRef.current;
        if (!canvas || !drawingRef.current) return;

        const ctx = canvas.getContext("2d");
        const point = pendingPointRef.current;
        
        if (point) {
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      });
    }
  };

  const commitStroke = () => {
    if (!drawingRef.current) return;

    drawingRef.current = false;
    activePointerIdRef.current = null;

    // 🎯 Anuluj pending RAF jeśli istnieje
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingPointRef.current = null;

    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (!stroke || stroke.points.length < 2) return;
    setStrokes((prev) => [...prev, stroke]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      
      // 🎯 Cleanup RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [tool, currentColor, strokeWidth]);

  const isPlacing = tool.startsWith("place_");
  const modeLabel = useMemo(() => {
    if (tool === "select") return "Selekcja";
    if (tool === "pencil") return "Ołówek";
    if (tool === "place_rect_fill") return "Kliknij na obrazie, aby wstawić: Prostokąt (fill)";
    if (tool === "place_rect_outline") return "Kliknij na obrazie, aby wstawić: Prostokąt (outline)";
    if (tool === "place_circle_fill") return "Kliknij na obrazie, aby wstawić: Koło (fill)";
    if (tool === "place_circle_outline") return "Kliknij na obrazie, aby wstawić: Koło (outline)";
    return "";
  }, [tool]);

  return (
    <main className={styles.page}>
      {!fsActive && (
        <header className={styles.topbar}>
          <div className={styles.actions}>
            {!fsActive && fsSupported && (
              <button className={styles.primaryBtn} onClick={manualEnter} type="button">
                FULLSCREEN (PEŁEN EKRAN)
              </button>
            )}
          </div>
        </header>
      )}

      <section className={styles.workspace}>
        <aside
          ref={panelWrapRef}
          className={`${styles.panelWrap} ${panelOpen ? styles.panelWrapOpen : styles.panelWrapClosed}`}
          aria-hidden={!panelOpen}
        >
          <div className={styles.panel}>
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
              <div className={styles.miniNote}>{modeLabel}</div>
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
                <button
                  className={tool === "place_rect_outline" ? styles.btnPrimary : styles.btn}
                  onClick={() => setTool("place_rect_outline")}
                  type="button"
                >
                  Bez wypełnienia
                </button>
                <button
                  className={tool === "place_rect_fill" ? styles.btnPrimary : styles.btn}
                  onClick={() => setTool("place_rect_fill")}
                  type="button"
                >
                  Z wypełnieniem
                </button>
              </div>
            </div>

            <div className={styles.group}>
              <div className={styles.groupLabel}>Koło</div>
              <div className={styles.btnRow}>
                <button
                  className={tool === "place_circle_outline" ? styles.btnPrimary : styles.btn}
                  onClick={() => setTool("place_circle_outline")}
                  type="button"
                >
                  Bez wypełnienia
                </button>
                <button
                  className={tool === "place_circle_fill" ? styles.btnPrimary : styles.btn}
                  onClick={() => setTool("place_circle_fill")}
                  type="button"
                >
                  Z wypełnieniem
                </button>
              </div>
            </div>

            <div className={styles.group}>
              <div className={styles.groupLabel}>Zaznaczenie</div>

              <div className={styles.selectedBox}>
                {selectedEl ? (
                  <>
                    <div className={styles.selectedLine}>
                      <span className={styles.muted}>Typ:</span>{" "}
                      {selectedEl.shape === "circle"
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
          </div>

          <button
            ref={panelToggleRef}
            className={styles.panelToggle}
            onClick={() => setPanelOpen((v) => !v)}
            type="button"
            aria-label={panelOpen ? "Zamknij panel" : "Otwórz panel"}
            title={panelOpen ? "Zamknij panel" : "Otwórz panel"}
          >
            {panelOpen ? "←" : "→"}
          </button>
        </aside>

        {/* 🎯 STAGE: obraz jako <img> zamiast background-image w CSS */}
        <div
          className={styles.stage}
          ref={stageRef}
          onPointerDownCapture={onStagePointerDownCapture}
        >
          <img src={bgImage} alt="" className={styles.bgImage} />
          
          <div className={styles.stageOverlay} />

          <canvas
            ref={canvasRef}
            className={`${styles.drawCanvas} ${tool === "pencil" ? styles.canvasActive : ""}`}
            aria-hidden="true"
          />

          <div className={tool === "pencil" ? styles.objectsPencil : styles.objectsSelect}>
            {elements.map((el) => {
              const isSelected = el.id === selectedId;
              const showEditor = isSelected;

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
                    if (tool !== "select") return;
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }}
                  className={showEditor ? styles.rndSelected : styles.rnd}
                >
                  <div
                    className={styles.shape}
                    style={{
                      borderRadius: el.shape === "circle" ? "50%" : "10px",
                      backgroundColor: el.filled ? el.color : "transparent",
                      border: el.filled ? "none" : `${el.strokeWidth || 3}px solid ${el.color}`,
                    }}
                  />

                  {showEditor && tool === "select" && (
                    <>
                      <span className={styles.handle} style={{ top: "-10px", left: "-10px" }} />
                      <span className={styles.handle} style={{ top: "-10px", right: "-10px" }} />
                      <span className={styles.handle} style={{ bottom: "-10px", left: "-10px" }} />
                      <span className={styles.handle} style={{ bottom: "-10px", right: "-10px" }} />
                      <span
                        className={styles.handle}
                        style={{ top: "-12px", left: "50%", transform: "translateX(-50%)" }}
                      />
                      <span
                        className={styles.handle}
                        style={{ bottom: "-12px", left: "50%", transform: "translateX(-50%)" }}
                      />
                      <span
                        className={styles.handle}
                        style={{ top: "50%", left: "-12px", transform: "translateY(-50%)" }}
                      />
                      <span
                        className={styles.handle}
                        style={{ top: "50%", right: "-12px", transform: "translateY(-50%)" }}
                      />
                    </>
                  )}
                </Rnd>
              );
            })}
          </div>

          {isPlacing && <div className={styles.placeHint}>Kliknij na obrazie, aby wstawić obiekt</div>}
        </div>
      </section>
    </main>
  );
}