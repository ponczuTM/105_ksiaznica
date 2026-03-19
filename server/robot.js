import express from "express";
import cors from "cors";
import { SerialPort } from "serialport";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());

let lastValue = "";

const SERIAL_PATH = "COM4";

app.get("/screen", (req, res) => {
  res.json({ distance: lastValue });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Serwer HTTP działa na http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws) => {
  console.log("🔌 Połączono z WebSocket");
  ws.send(JSON.stringify({ distance: lastValue }));

  ws.on("close", () => {
    console.log("❌ Rozłączono WebSocket");
  });
});

function broadcastDistanceUpdate() {
  const message = JSON.stringify({ distance: lastValue });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// --- Tryb symulacji (brak urządzenia) ---
function startSimulationMode() {
  console.warn(`⚠️  Tryb symulacji: nie znaleziono ${SERIAL_PATH}.`);

  // Natychmiast wyślij XX
  lastValue = "XX";
  console.log("[SYMULACJA] Start -> XX");
  broadcastDistanceUpdate();

  // Naprzemiennie XX <-> AB co 5 sekund
  setInterval(() => {
    lastValue = lastValue === "XX" ? "AB" : "XX";
    console.log(`[SYMULACJA] Wysyłanie: ${lastValue}`);
    broadcastDistanceUpdate();
  }, 5000);
}

// --- Próba otwarcia portu szeregowego ---
let port;
try {
  port = new SerialPort({
    path: SERIAL_PATH,
    baudRate: 115200,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
  });

  let buffer = "";
  let timeout = null;

  port.on("open", () => {
    console.log(`✅ Sukces: Otwarto port ${SERIAL_PATH}`);
  });

  port.on("data", (data) => {
    buffer += data.toString();

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      const match = buffer.match(/=([A-Za-z0-9]+)/);

      if (match) {
        lastValue = match[1];
        console.log("Odebrano wartość:", lastValue);
        broadcastDistanceUpdate();
      } else {
        console.log("Dane niepasujące do wzorca:", buffer);
      }

      buffer = "";
    }, 10);
  });

  port.on("error", (err) => {
    console.error(`❌ Błąd portu ${SERIAL_PATH}:`, err.message);
    startSimulationMode();
  });
} catch (err) {
  console.error(`❌ Nie można zainicjować portu ${SERIAL_PATH}:`, err.message);
  startSimulationMode();
}

console.log(`🚀 Nasłuchiwanie na ${SERIAL_PATH}...`);
