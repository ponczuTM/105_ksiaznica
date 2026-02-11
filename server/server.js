// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import os from "os";
import dgram from "dgram";
import { fileURLToPath } from "url";

/**
 * Pobiera IP LAN w stylu "pythonowego" tricku:
 * tworzymy UDP socket i "łączymy się" z 8.8.8.8, żeby system wybrał interfejs.
 */
function getLocalIp() {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.on("error", (err) => {
      socket.close();
      reject(err);
    });

    // Port bez znaczenia — nie wysyłamy nic, tylko wymuszamy routing
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
 * ZAWSZE nadpisuje ../.env w formacie:
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

// Preflight dla każdej ścieżki - bez app.options("*")
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

let currentVideoId = null;
let resetTimer = null;

// GET: backend cały czas wystawia aktualny stan
app.get("/get", (req, res) => {
  res.json({ videoid: currentVideoId });
});

// POST: ustaw videoId na 3 sekundy i wróć do null
app.post("/post/:videoId", (req, res) => {
  const { videoId } = req.params;

  console.log(`otrzymałem videoId: ${videoId}`);

  currentVideoId = String(videoId);

  if (resetTimer) clearTimeout(resetTimer);

  resetTimer = setTimeout(() => {
    currentVideoId = null;
    console.log("ustawiam videoId na null");
  }, 3000);

  res.json({ ok: true, videoid: currentVideoId });
});

// START: najpierw zapisz .env, potem odpal serwer
(async () => {
  try {
    const ip = await getLocalIp();
    const envPath = writeEnvFile(ip, 3001);

    console.log(`Zapisano ${envPath}`);
    console.log(`VITE_BACKEND_IP=${ip}`);
    console.log(`VITE_BACKEND_PORT=3001`);

    // Ważne: słuchaj na 0.0.0.0 żeby było dostępne po LAN
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API działa na porcie ${PORT}`);
      console.log(`GET  -> http://0.0.0.0:${PORT}/get`);
      console.log(`POST -> http://0.0.0.0:${PORT}/post/:videoId`);
    });
  } catch (err) {
    console.error("Nie udało się wykryć IP / zapisać .env:", err);
    process.exit(1);
  }
})();
