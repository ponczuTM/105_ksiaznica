// server.js
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS totalnie otwarte
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));

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

// Ważne: słuchaj na 0.0.0.0 żeby było dostępne po LAN
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API działa na porcie ${PORT}`);
  console.log(`GET  -> http://0.0.0.0:${PORT}/get`);
  console.log(`POST -> http://0.0.0.0:${PORT}/post/:videoId`);
});
