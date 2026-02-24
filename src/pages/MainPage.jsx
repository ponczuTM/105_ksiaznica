import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { HexColorPicker } from "react-colorful";
import styles from "./MainPage.module.css";
import bgImage from "../assets/images/image.jpg";
import IPChecker from "./IPChecker";

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

// Stałe dla zoomu
const MIN_ZOOM = 1;  // 20% - minimalne oddalenie
const MAX_ZOOM = 5.0;  // 500% - maksymalne przybliżenie

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
  const containerRef = useRef(null); // Nowy ref dla kontenera z transformacją

  // 🎯 ZOOM i PAN
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastDistanceRef = useRef(0);
  const lastCenterRef = useRef({ x: 0, y: 0 });
  const activeTouchesRef = useRef([]);

  // 🎯 React-colorful picker (open/close + click outside)
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerWrapRef = useRef(null);

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

  // =========================
  // ZOOM i PAN LOGIC z ograniczeniami
  // =========================
  const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(value, MAX_ZOOM));
  
  // Oblicz maksymalne przesunięcie na podstawie zoomu i rozmiarów
  const calculateMaxPan = useCallback(() => {
    if (!containerRef.current || !stageRef.current) return { maxX: 0, maxY: 0 };
    
    const container = containerRef.current;
    const stage = stageRef.current;
    
    const containerRect = container.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    
    // Gdy zoom < 1 (oddalenie), obraz jest mniejszy niż kontener
    // Ograniczamy przesunięcie, aby obraz nie "uciekał" z widoku
    if (zoom < 1) {
      const scaledWidth = stageRect.width * zoom;
      const scaledHeight = stageRect.height * zoom;
      
      // Gdy obraz jest mniejszy od kontenera, ograniczamy przesunięcie
      // aby centrować obraz
      const horizontalMargin = (containerRect.width - scaledWidth) / 2;
      const verticalMargin = (containerRect.height - scaledHeight) / 2;
      
      return {
        maxX: Math.max(0, horizontalMargin),
        maxY: Math.max(0, verticalMargin)
      };
    } else {
      // Gdy zoom >= 1 (przybliżenie), obraz jest większy niż kontener
      const scaledWidth = stageRect.width * zoom;
      const scaledHeight = stageRect.height * zoom;
      
      // Maksymalne przesunięcie to różnica między przeskalowanym obrazem a kontenerem
      const maxX = Math.max(0, (scaledWidth - containerRect.width) / 2);
      const maxY = Math.max(0, (scaledHeight - containerRect.height) / 2);
      
      return { maxX, maxY };
    }
  }, [zoom]);

  const clampPan = useCallback((x, y) => {
    const { maxX, maxY } = calculateMaxPan();
    
    // Dla zoom < 1, obraz jest wycentrowany - przesunięcie powinno być ograniczone
    if (zoom < 1) {
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y))
      };
    } else {
      // Dla zoom >= 1, standardowe ograniczenia
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y))
      };
    }
  }, [zoom, calculateMaxPan]);

  // Funkcja do aktualizacji zoomu z automatycznym centrowaniem przy oddalaniu
  const updateZoomAndPan = useCallback((newZoom, centerX, centerY) => {
    if (!containerRef.current || !stageRef.current) return;
    
    const container = containerRef.current;
    const stage = stageRef.current;
    
    const containerRect = container.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    
    const clampedZoom = clampZoom(newZoom);
    
    // Gdy oddalamy (zoom zmniejsza się) i osiągamy minimum, wycentruj obraz
    if (clampedZoom === MIN_ZOOM && clampedZoom < zoom) {
      const newOffset = { x: 0, y: 0 };
      setZoom(clampedZoom);
      setPanOffset(newOffset);
      return;
    }
    
    // Gdy przybliżamy (zoom zwiększa się) z centrum
    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = clampedZoom / zoom;
      
      const newOffset = {
        x: centerX - (centerX - panOffset.x) * zoomRatio,
        y: centerY - (centerY - panOffset.y) * zoomRatio
      };
      
      const clamped = clampPan(newOffset.x, newOffset.y);
      setZoom(clampedZoom);
      setPanOffset(clamped);
    } else {
      // Bez centrum - po prostu ustaw nowy zoom i popraw pan
      const clamped = clampPan(panOffset.x, panOffset.y);
      setZoom(clampedZoom);
      setPanOffset(clamped);
    }
  }, [zoom, panOffset, clampPan]);

  const handleTouchStart = useCallback((e) => {
    if (tool !== "gestures") return;
    
    e.preventDefault();
    
    const touches = Array.from(e.touches);
    activeTouchesRef.current = touches;
    
    if (touches.length === 1) {
      // Rozpoczęcie przesuwania
      isPanningRef.current = true;
      panStartRef.current = {
        x: touches[0].clientX - panOffset.x,
        y: touches[0].clientY - panOffset.y
      };
    } else if (touches.length === 2) {
      // Rozpoczęcie pinch-to-zoom
      isPanningRef.current = false;
      
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      lastDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      
      lastCenterRef.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
    }
  }, [tool, panOffset]);

  const handleTouchMove = useCallback((e) => {
    if (tool !== "gestures") return;
    
    e.preventDefault();
    
    const touches = Array.from(e.touches);
    activeTouchesRef.current = touches;
    
    if (touches.length === 1 && isPanningRef.current) {
      // Przesuwanie jednym palcem
      const newPan = {
        x: touches[0].clientX - panStartRef.current.x,
        y: touches[0].clientY - panStartRef.current.y
      };
      
      const clamped = clampPan(newPan.x, newPan.y);
      setPanOffset(clamped);
    } else if (touches.length === 2) {
      // Pinch-to-zoom z limitami
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (lastDistanceRef.current > 0) {
        const zoomFactor = distance / lastDistanceRef.current;
        const proposedZoom = zoom * zoomFactor;
        
        // Sprawdź czy proponowany zoom mieści się w limitach
        if (proposedZoom < MIN_ZOOM || proposedZoom > MAX_ZOOM) {
          // Jeśli wychodzimy poza limity, ogranicz ale kontynuuj śledzenie dystansu
          // dla płynności gdy użytkownik wróci w dozwolony zakres
          lastDistanceRef.current = distance;
          return;
        }
        
        const newZoom = clampZoom(proposedZoom);
        
        const centerX = (touches[0].clientX + touches[1].clientX) / 2;
        const centerY = (touches[0].clientY + touches[1].clientY) / 2;
        
        updateZoomAndPan(newZoom, centerX, centerY);
      }
      
      lastDistanceRef.current = distance;
      lastCenterRef.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
    }
  }, [tool, zoom, panOffset, clampPan, updateZoomAndPan]);

  const handleTouchEnd = useCallback((e) => {
    if (tool !== "gestures") return;
    
    e.preventDefault();
    
    const touches = Array.from(e.touches);
    activeTouchesRef.current = touches;
    
    if (touches.length === 0) {
      isPanningRef.current = false;
      lastDistanceRef.current = 0;
    } else if (touches.length === 1) {
      isPanningRef.current = true;
      panStartRef.current = {
        x: touches[0].clientX - panOffset.x,
        y: touches[0].clientY - panOffset.y
      };
      lastDistanceRef.current = 0;
    } else if (touches.length === 2) {
      isPanningRef.current = false;
    }
  }, [tool, panOffset]);

  const resetZoomAndPan = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // =========================
  // MYSZKA - zoom kółkiem z limitami
  // =========================
  const handleWheel = useCallback((e) => {
    if (tool !== "gestures") return;
    
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const proposedZoom = zoom * delta;
    
    // Sprawdź czy proponowany zoom mieści się w limitach
    if (proposedZoom < MIN_ZOOM || proposedZoom > MAX_ZOOM) {
      return; // Nie pozwól na zoom poza limitami
    }
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    
    updateZoomAndPan(proposedZoom, centerX, centerY);
  }, [tool, zoom, updateZoomAndPan]);

  // =========================
  // Event listeners dla touch/mouse
  // =========================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: false });
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  // Automatycznie koryguj pan przy zmianie zoomu
  useEffect(() => {
    const clamped = clampPan(panOffset.x, panOffset.y);
    if (clamped.x !== panOffset.x || clamped.y !== panOffset.y) {
      setPanOffset(clamped);
    }
  }, [zoom, panOffset, clampPan]);

  const getStageRect = () => {
    const el = stageRef.current;
    if (!el) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  // Modyfikacja clampToStage - musi uwzględniać zoom i pan
  const clampToStage = (x, y, w, h) => {
    const { width, height } = getStageRect();
    const nx = Math.max(0, Math.min(x, Math.max(0, width - w)));
    const ny = Math.max(0, Math.min(y, Math.max(0, height - h)));
    return { x: nx, y: ny };
  };

  // =========================
  // PLACE TOOL (uwzględnia zoom i pan)
  // =========================
  const createElementAt = (clientX, clientY) => {
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
    const stageRect = stage.getBoundingClientRect();
    
    // Oblicz pozycję względem przeskalowanego i przesuniętego stage
    let x0 = clientX - stageRect.left;
    let y0 = clientY - stageRect.top;
    
    // Jeśli jest zoom/pan, przelicz pozycję
    if (zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) {
      x0 = (x0 - panOffset.x) / zoom;
      y0 = (y0 - panOffset.y) / zoom;
    }
    
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

  const clearCanvas = () => {
    // 1) usuń obiekty (rect/circle)
    setElements([]);
    setSelectedId(null);
  
    // 2) usuń pociągnięcia ołówka
    setStrokes([]);
  
    // 3) zatrzymaj ewentualne rysowanie "w locie"
    drawingRef.current = false;
    activePointerIdRef.current = null;
    currentStrokeRef.current = null;
    pendingPointRef.current = null;
  
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  
    // 4) wyczyść natychmiast canvas (bez czekania na efekt setStrokes)
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
    }
  
    // 5) opcjonalnie wróć do trybu selekcji
    setTool("select");
    
    // 6) zresetuj zoom i pan
    resetZoomAndPan();
  };

  // =========================
  // COLOR PICKER (react-colorful)
  // =========================
  useEffect(() => {
    if (!colorPickerOpen) return;

    const onPointerDown = (e) => {
      const wrap = colorPickerWrapRef.current;
      if (!wrap) return;
      if (wrap.contains(e.target)) return;
      setColorPickerOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [colorPickerOpen]);

  const applyColor = useCallback(
    (hex) => {
      setCurrentColor(hex);
      if (selectedId) updateSelected({ color: hex });
    },
    [selectedId]
  );

  // =========================
  // CANVAS: resize + redraw (uwzględnia zoom)
  // =========================
  const redrawAllStrokes = useCallback(
    (ctx) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Pobierz rozmiary canvasa (już przeskalowane przez resizeCanvasToStage)
      const { width, height } = canvas.getBoundingClientRect();
      
      // Sprawdź dpr canvasa
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvasWidth = canvas.width / dpr;
      const canvasHeight = canvas.height / dpr;
      
      // Wyczyść cały canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const s of strokes) {
        if (!s.points || s.points.length < 2) continue;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;

        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      }
    },
    [strokes]
  );

  const resizeCanvasToStage = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = stage.getBoundingClientRect();

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${Math.floor(width)}px`;
    canvas.style.height = `${Math.floor(height)}px`;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
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
  // PENCIL: RAF BATCHING (uwzględnia zoom i pan)
  // =========================
  const getLocalPoint = (evt) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    
    const stageRect = stage.getBoundingClientRect();
    let x = evt.clientX - stageRect.left;
    let y = evt.clientY - stageRect.top;
    
    // Przelicz na współrzędne niezależne od zoomu/pan
    if (zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) {
      x = (x - panOffset.x) / zoom;
      y = (y - panOffset.y) / zoom;
    }
    
    return { x, y };
  };

  const beginStroke = (evt) => {
    // RYSUJ TYLKO W TRYBIE OŁÓWEK, NIE W TRYBIE GESTY!
    if (tool !== "pencil") return;
    
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

  const extendStroke = (evt) => {
    if (!drawingRef.current) return;
    if (activePointerIdRef.current !== evt.pointerId) return;

    const stroke = currentStrokeRef.current;
    if (!stroke) return;

    const p = getLocalPoint(evt);
    stroke.points.push(p);

    pendingPointRef.current = p;

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

  // =========================
  // EVENT LISTENERS DLA OŁÓWKA - TYLKO W TRYBIE PENCIL!
  // =========================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const opts = { passive: false };

    const onPointerDown = (e) => {
      // RYSUJ TYLKO W TRYBIE OŁÓWEK!
      if (tool !== "pencil") return;
      
      e.preventDefault();
      e.stopPropagation();
      beginStroke(e);
    };

    const onPointerMove = (e) => {
      // RYSUJ TYLKO W TRYBIE OŁÓWEK!
      if (tool !== "pencil") return;
      if (!drawingRef.current) return;
      
      e.preventDefault();
      extendStroke(e);
    };

    const onPointerUp = (e) => {
      // RYSUJ TYLKO W TRYBIE OŁÓWEK!
      if (tool !== "pencil") return;
      
      e.preventDefault();
      commitStroke();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerCancel = (e) => {
      // RYSUJ TYLKO W TRYBIE OŁÓWEK!
      if (tool !== "pencil") return;
      
      commitStroke();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onLostPointerCapture = () => {
      // RYSUJ TYLKO W TRYBIE OŁÓWEK!
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

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [tool, currentColor, strokeWidth]); // Tylko zależności potrzebne dla ołówka

  const isPlacing = tool.startsWith("place_");
  const modeLabel = useMemo(() => {
    if (tool === "select") return "Selekcja";
    if (tool === "pencil") return "Ołówek";
    if (tool === "gestures") return "Gesty (przytrzymaj 2 palce do zoom)";
    if (tool === "place_rect_fill") return "Kliknij na obrazie, aby wstawić: Prostokąt (fill)";
    if (tool === "place_rect_outline") return "Kliknij na obrazie, aby wstawić: Prostokąt (outline)";
    if (tool === "place_circle_fill") return "Kliknij na obrazie, aby wstawić: Koło (fill)";
    if (tool === "place_circle_outline") return "Kliknij na obrazie, aby wstawić: Koło (outline)";
    return "";
  }, [tool]);

  // Sprawdź czy osiągnięto limity zoomu
  const isAtMinZoom = zoom <= MIN_ZOOM;
  const isAtMaxZoom = zoom >= MAX_ZOOM;

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
          <IPChecker/>
        </header>
        
      )}

      <section className={styles.workspace}>
        <aside
          ref={panelWrapRef}
          className={`${styles.panelWrap} ${panelOpen ? styles.panelWrapOpen : styles.panelWrapClosed}`}
          aria-hidden={!panelOpen}
        >
          <div className={styles.panel}>
            <div className={styles.group}>
              <div className={styles.groupLabel}>Tryb</div>
              <div className={styles.btnRow}>
                <button
                  className={tool === "select" ? styles.btnPrimary : styles.btn}
                  onClick={() => {
                    setTool("select");
                    resetZoomAndPan();
                  }}
                  type="button"
                >
                  Selekcja
                </button>
                <button
                  className={tool === "pencil" ? styles.btnPrimary : styles.btn}
                  onClick={() => {
                    setSelectedId(null);
                    setTool("pencil");
                    resetZoomAndPan();
                  }}
                  type="button"
                >
                  Ołówek
                </button>
                <button
                  className={tool === "gestures" ? styles.btnPrimary : styles.btn}
                  onClick={() => {
                    setSelectedId(null);
                    setTool("gestures");
                  }}
                  type="button"
                >
                  Gesty
                </button>
              </div>
              <div className={styles.miniNote}>{modeLabel}</div>
              {tool === "gestures" && (
                <div className={styles.miniNote}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span>Zoom: {Math.round(zoom * 100)}%</span>
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      {isAtMinZoom && 'MIN'}
                      {isAtMaxZoom && 'MAX'}
                    </div>
                  </div>
                  <button 
                    onClick={resetZoomAndPan}
                    className={styles.btnSmall}
                    type="button"
                  >
                    Resetuj widok (100%)
                  </button>
                </div>
              )}
            </div>

            <div className={styles.group}>
              <div className={styles.groupLabel}>Kolor</div>

              {/* 🎯 react-colorful picker */}
              <div ref={colorPickerWrapRef} className={styles.colorPickerWrap}>
                <button
                  className={styles.colorBtn}
                  style={{ background: currentColor }}
                  onClick={() => setColorPickerOpen((v) => !v)}
                  type="button"
                >
                  {colorPickerOpen ? "Zamknij" : "Wybierz kolor"}
                </button>

                {colorPickerOpen && (
                  <div className={styles.colorPopover} role="dialog" aria-label="Wybór koloru">
                    <HexColorPicker color={currentColor} onChange={applyColor} />
                    <div className={styles.colorMeta}>
                      <div className={styles.colorSwatch} style={{ background: currentColor }} />
                      <span className={styles.colorValue}>{currentColor.toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </div>

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

              <div className={styles.btnRow} style={{ marginTop: "10px" }}>
                <button className={styles.btnDanger} onClick={clearCanvas} type="button">
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* <button
            ref={panelToggleRef}
            className={styles.panelToggle}
            onClick={() => setPanelOpen((v) => !v)}
            type="button"
            aria-label={panelOpen ? "Zamknij panel" : "Otwórz panel"}
            title={panelOpen ? "Zamknij panel" : "Otwórz panel"}
          >
            {panelOpen ? "⭣" : "⭡"}
          </button> */}
          <button
  ref={panelToggleRef}
  className={styles.panelToggle}
  onClick={() => setPanelOpen(v => !v)}
  type="button"
  aria-label={panelOpen ? "Zamknij panel" : "Otwórz panel"}
  title={panelOpen ? "Zamknij panel" : "Otwórz panel"}
>
  {panelOpen ? (
    // strzałka w dół
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 8L14 8V10L8 16L2 10V8H6V0L10 4.76995e-08V8Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    // strzałka w górę
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 8L2 8L2 6L8 5.24536e-07L14 6L14 8L10 8L10 16L6 16L6 8Z"
        fill="currentColor"
      />
    </svg>
  )}
</button>

        </aside>

        {/* Kontener dla zoomu i pan */}
        <div 
          ref={containerRef}
          className={styles.zoomContainer}
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            cursor: tool === 'gestures' ? (isAtMinZoom && isAtMaxZoom ? 'default' : 'grab') : 'default'
          }}
        >
          <div 
            className={styles.stage} 
            ref={stageRef} 
            onPointerDownCapture={onStagePointerDownCapture}
          >
            <img src={bgImage} alt="" className={styles.bgImage} />

            <div className={styles.stageOverlay} />

            {/* Canvas jest aktywny tylko w trybie OŁÓWEK, nie w trybie GESTY */}
            <canvas
              ref={canvasRef}
              className={`${styles.drawCanvas} ${tool === "pencil" ? styles.canvasActive : ""}`}
              aria-hidden="true"
            />

            {/* W trybie GESTY również nie pokazujemy uchwytów do elementów */}
            <div className={tool === "pencil" ? styles.objectsPencil : styles.objectsSelect}>
              {elements.map((el) => {
                const isSelected = el.id === selectedId;
                // W trybie GESTY nie pokazujemy edytora - tylko w trybie SELECT
                const showEditor = isSelected && tool === "select";

                return (
                  <Rnd
                    key={el.id}
                    size={{ width: el.width, height: el.height }}
                    position={{ x: el.x, y: el.y }}
                    bounds="parent"
                    disableDragging={tool !== "select"} // Tylko w trybie SELECT można przeciągać
                    enableResizing={tool === "select"} // Tylko w trybie SELECT można zmieniać rozmiar
                    onDragStop={(e, d) => {
                      // Tylko w trybie SELECT aktualizujemy pozycję
                      if (tool !== "select") return;
                      setElements((prev) => prev.map((p) => (p.id === el.id ? { ...p, x: d.x, y: d.y } : p)));
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      // Tylko w trybie SELECT aktualizujemy rozmiar
                      if (tool !== "select") return;
                      const newW = parseInt(ref.style.width, 10);
                      const newH = parseInt(ref.style.height, 10);
                      setElements((prev) =>
                        prev.map((p) =>
                          p.id === el.id ? { ...p, width: newW, height: newH, x: position.x, y: position.y } : p
                        )
                      );
                    }}
                    onPointerDown={(e) => {
                      // W trybie SELECT zaznaczamy element
                      // W trybie GESTY ignorujemy kliknięcie na element
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

                    {/* Pokazuj uchwyty tylko w trybie SELECT i gdy element jest zaznaczony */}
                    {showEditor && (
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
        </div>
      </section>
    </main>
  );
}