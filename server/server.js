// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import dgram from "dgram";
import { fileURLToPath } from "url";

/**
 * Pobiera IP LAN:
 * tworzymy UDP socket i "łączymy się" z 8.8.8.8, żeby system wybrał interfejs.
 */
function getLocalIp() {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.on("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.connect(80, "8.8.8.8", () => {
      try {
        const addr = socket.address();
        socket.close();
        resolve(addr.address);
      } catch (e) {
        socket.close();
        reject(e);
      }
    });
  });
}

/**
 * ZAWSZE nadpisuje ../.env:
 * VITE_BACKEND_IP=<ip>
 * VITE_BACKEND_PORT=3001
 */
function writeEnvFile(ip, port = 3001) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const envPath = path.resolve(__dirname, "..", ".env");
  const content = `VITE_BACKEND_IP=${ip}\nVITE_BACKEND_PORT=${port}\n`;

  fs.writeFileSync(envPath, content, { encoding: "utf-8" });
  return envPath;
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS totalnie otwarte
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Preflight
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

/**
 * Stan backendu:
 * - currentVideoId: "1".."10" albo null
 * - command: "PLAY" | "STOP" | "BACK" | "NONE"
 * - commandId: rośnie za każdym razem, żeby Player wykrywał "nową komendę"
 */
let currentVideoId = null;
let command = "NONE";
let commandId = 0;

function bumpCommand(newCommand) {
  command = newCommand;
  commandId += 1;
}

// GET: Player polluje ten endpoint
app.get("/get", (req, res) => {
  res.json({
    videoid: currentVideoId,
    command,
    commandId,
  });
});

// POST: wybór wideo z Viewera
app.post("/post/:videoId", (req, res) => {
  const { videoId } = req.params;

  console.log(`Viewer -> wybór videoId: ${videoId}`);

  currentVideoId = String(videoId);
  bumpCommand("PLAY");

  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// STOP
app.post("/control/stop", (req, res) => {
  console.log("Viewer -> STOP");
  bumpCommand("STOP");
  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// PLAY (wznów / odpal)
app.post("/control/play", (req, res) => {
  console.log("Viewer -> PLAY");
  bumpCommand("PLAY");
  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// BACK: OBLIGATORYJNIE videoid = null + komenda BACK
app.post("/control/back", (req, res) => {
  console.log("Viewer -> BACK (ustawiam videoid=null)");
  currentVideoId = null;
  bumpCommand("BACK");
  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// START
(async () => {
  try {
    const ip = await getLocalIp();
    const envPath = writeEnvFile(ip, 3001);

    console.log(`Zapisano ${envPath}`);
    console.log(`VITE_BACKEND_IP=${ip}`);
    console.log(`VITE_BACKEND_PORT=3001`);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API działa na porcie ${PORT}`);
      console.log(`GET  -> http://0.0.0.0:${PORT}/get`);
      console.log(`POST -> http://0.0.0.0:${PORT}/post/:videoId`);
      console.log(`POST -> http://0.0.0.0:${PORT}/control/stop`);
      console.log(`POST -> http://0.0.0.0:${PORT}/control/play`);
      console.log(`POST -> http://0.0.0.0:${PORT}/control/back`);
    });
  } catch (err) {
    console.error("Nie udało się wykryć IP / zapisać .env:", err);
    process.exit(1);
  }
})();
