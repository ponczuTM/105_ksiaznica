import { useMemo, useState } from "react";

const SERVER_BASE =
  import.meta?.env?.VITE_IMAGE_SERVER ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

export default function SendImage() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastUrl, setLastUrl] = useState("");

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  const onPick = (e) => {
    setMsg("");
    setLastUrl("");
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const onUpload = async () => {
    if (!file) {
      setMsg("Wybierz plik.");
      return;
    }

    try {
      setBusy(true);
      setMsg("Wysyłam...");

      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${SERVER_BASE}/api/background`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }

      // URL zwracany jako /uploads/...
      setLastUrl(`${SERVER_BASE}${data.url}?t=${Date.now()}`);
      setMsg("Wysłane. MainPage powinien się zaktualizować automatycznie.");
    } catch (err) {
      setMsg(`Błąd: ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "20px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2 style={{ marginTop: 0 }}>Wyślij obraz tła</h2>

      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Serwer: <b>{SERVER_BASE}</b>
      </p>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onPick}
        disabled={busy}
      />

      {previewUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6, opacity: 0.8 }}>Podgląd:</div>
          <img
            src={previewUrl}
            alt="preview"
            style={{ width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>
      )}

      <button
        onClick={onUpload}
        disabled={busy || !file}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: "none",
          background: busy ? "#999" : "#111",
          color: "#fff",
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
        type="button"
      >
        {busy ? "Wysyłam..." : "UPLOAD"}
      </button>

      {msg && <div style={{ marginTop: 12 }}>{msg}</div>}

      {lastUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6, opacity: 0.8 }}>Ostatnio wysłane (z serwera):</div>
          <img
            src={lastUrl}
            alt="uploaded"
            style={{ width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>
      )}
    </div>
  );
}