// ImageServer.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Folder na uploady
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Trzymamy nazwę aktualnego tła (w pamięci). Możesz to łatwo utrwalić w pliku.
let currentBackground = null;

// Multer: zapis do uploads/ z unikalną nazwą
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".png";
    cb(null, `bg-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (!ok) return cb(new Error("Dozwolone tylko JPG/PNG/WEBP"));
    cb(null, true);
  },
});

// Serwuj uploady statycznie
app.use("/uploads", express.static(UPLOAD_DIR, {
  // Bez agresywnego cache po stronie przeglądarki (i tak dorzucamy cache-buster)
  etag: false,
  maxAge: 0,
}));

// Pobranie info o aktualnym tle (dla MainPage po odświeżeniu)
app.get("/api/background", (req, res) => {
  if (!currentBackground) return res.json({ url: null });
  res.json({ url: `/uploads/${currentBackground}` });
});

// Upload nowego tła
app.post("/api/background", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "Brak pliku" });

  // Opcjonalnie: usuń poprzednie tło, żeby nie zaśmiecać dysku
  if (currentBackground) {
    const prevPath = path.join(UPLOAD_DIR, currentBackground);
    fs.promises.unlink(prevPath).catch(() => {});
  }

  currentBackground = req.file.filename;
  const url = `/uploads/${currentBackground}`;

  broadcast({ type: "bgUpdated", url });

  res.json({ ok: true, url });
});

// Serwer HTTP + WS na tym samym porcie
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Prosty broadcast do wszystkich klientów
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on("connection", (ws) => {
  // Po podłączeniu od razu wyślij obecne tło (jeśli jest)
  if (currentBackground) {
    ws.send(JSON.stringify({ type: "bgUpdated", url: `/uploads/${currentBackground}` }));
  }
});

server.listen(PORT, () => {
  console.log(`ImageServer running on http://0.0.0.0:${PORT}`);
  console.log(`Upload endpoint: POST /api/background (multipart: image)`);
});