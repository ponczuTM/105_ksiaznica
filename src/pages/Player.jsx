import { useEffect, useMemo, useState } from "react";

const COPY = {
  "1": "To świetny wybór na dzisiaj!",
  "2": "Brzmi jak plan idealny.",
  "3": "Doskonały sposób na dobry humor.",
  "4": "To świetny wybór na dzisiaj!",
  "5": "Ciekawa decyzja, gratulacje!",
  "6": "Warto o tym pamiętać częściej.",
  "7": "To strzał w dziesiątkę!",
  "8": "Nie każdy by na to wpadł, brawo!",
  "9": "To rozwiązanie ma wiele zalet!",
  "10": "Brzmi jak plan idealny.",
  "11": "Warto o tym pamiętać częściej.",
  "12": "To świetny wybór na dzisiaj!",
  "13": "Ciekawa decyzja, gratulacje!",
  "14": "Doskonały sposób na dobry humor.",
  "15": "To strzał w dziesiątkę!"
}

export default function Player() {
  const [status, setStatus] = useState("DISCONNECTED");
  const [lastItem, setLastItem] = useState(null);

  const wsUrl = useMemo(() => {
    const base = import.meta.env.VITE_WS_URL;
    return `${base}?role=player`;
  }, []);

  useEffect(() => {
    console.log("VITE_WS_URL =", import.meta.env.VITE_WS_URL);
    console.log("wsUrl =", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WS open");
      setStatus("CONNECTED");
    };

    ws.onerror = (e) => {
      console.error("WS error", e);
      setStatus("ERROR");
    };

    ws.onclose = (e) => {
      console.warn("WS close", { code: e.code, reason: e.reason, wasClean: e.wasClean });
      setStatus("DISCONNECTED");
    };

    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (msg?.type === "selection" && typeof msg.item === "string") {
        setLastItem(msg.item);
      }
    };

    return () => {
      try { ws.close(); } catch {}
    };
  }, [wsUrl]);

  const text = lastItem ? (COPY[lastItem] || `Wybrałeś: ${lastItem}`) : "Czekam na wybór z Viewera…";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Player</h1>
      <div>WS: <b>{status}</b></div>

      <div style={{ marginTop: 16, fontSize: 24, fontWeight: 900 }}>
        {text}
      </div>
    </div>
  );
}
