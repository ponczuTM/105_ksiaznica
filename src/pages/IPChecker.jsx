import { useEffect, useState } from "react";

function isIPv4(s) {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  for (let i = 1; i <= 4; i++) {
    const n = Number(m[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
}

function isPrivateIPv4(ip) {
  if (!isIPv4(ip)) return false;
  const [a, b] = ip.split(".").map(Number);

  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

export default function IPChecker() {
  const [ip1, setIp1] = useState("");
  const [ip2, setIp2] = useState("");
  const [status, setStatus] = useState("Wykrywam IP...");

  useEffect(() => {
    let cancelled = false;

    const RTCPeerConnection =
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection;

    if (!RTCPeerConnection) {
      setStatus("Brak WebRTC – nie da się wykryć lokalnego IP.");
      return;
    }

    const found = new Set();

    const pc = new RTCPeerConnection({ iceServers: [] });

    const updateIps = () => {
      const arr = Array.from(found);
      const a = arr[0] || "";
      const b = arr[1] || "";
      setIp1(a);
      setIp2(b);
      setStatus(arr.length ? "OK" : "Nie znaleziono prywatnych IPv4.");
    };

    pc.onicecandidate = (event) => {
      if (!event?.candidate?.candidate) return;

      const c = event.candidate.candidate;
      const parts = c.trim().split(/\s+/);
      const address = parts[4];

      if (!address) return;

      if (isPrivateIPv4(address)) {
        found.add(address);

        // tylko dwa pierwsze prywatne IPv4
        if (found.size > 2) {
          const firstTwo = Array.from(found).slice(0, 2);
          found.clear();
          firstTwo.forEach((x) => found.add(x));
        }

        if (!cancelled) updateIps();
      }
    };

    (async () => {
      try {
        pc.createDataChannel("x");
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        setTimeout(() => {
          try {
            pc.close();
          } catch {}
          if (!cancelled) updateIps();
        }, 1200);
      } catch (e) {
        try {
          pc.close();
        } catch {}
        if (!cancelled) setStatus("Błąd: " + (e?.message || String(e)));
      }
    })();

    return () => {
      cancelled = true;
      try {
        pc.close();
      } catch {}
    };
  }, []);

  // wymagany format: <ip1>,<ip2>
  return (
    <div>
      {ip1 || ip2 ? `${ip1},${ip2}` : status}
    </div>
  );
}