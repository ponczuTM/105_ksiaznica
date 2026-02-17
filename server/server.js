// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function writeEnvFile() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const envPath = path.resolve(__dirname, "..", ".env");

  const content = `VITE_BACKEND_IP=192.168.68.11
VITE_BACKEND_PORT=3001
`;

  fs.writeFileSync(envPath, content, { encoding: "utf-8" });
  return envPath;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

let currentVideoId = null;
let command = "NONE";
let commandId = 0;

function bumpCommand(newCommand) {
  command = newCommand;
  commandId += 1;
}

// GET: stan
app.get("/get", (req, res) => {
  res.json({ videoid: currentVideoId, command, commandId });
});

// Viewer wybiera wideo
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

// PLAY
app.post("/control/play", (req, res) => {
  console.log("Viewer -> PLAY");
  bumpCommand("PLAY");
  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// BACK
app.post("/control/back", (req, res) => {
  console.log("Viewer -> BACK (ustawiam videoid=null)");
  currentVideoId = null;
  bumpCommand("BACK");
  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// Player -> wideo się skończyło
app.post("/ended", (req, res) => {
  const endedId = req.body?.videoid ?? null;

  console.log(`Player -> ENDED (videoid=${endedId}) -> ustawiam videoid=null`);

  currentVideoId = null;
  bumpCommand("BACK");

  res.json({ ok: true, videoid: currentVideoId, command, commandId });
});

// START
(() => {
  try {
    const envPath = writeEnvFile();

    console.log(`Zapisano ${envPath}`);
    console.log(`VITE_BACKEND_IP=192.168.68.11`);
    console.log(`VITE_BACKEND_PORT=3001`);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API działa na porcie ${PORT}`);
    });
  } catch (err) {
    console.error("Nie udało się zapisać .env:", err);
    process.exit(1);
  }
})();
