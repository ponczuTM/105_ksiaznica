import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,      // nasłuch na 0.0.0.0 (LAN)
    port: 5173,      // możesz zmienić
    strictPort: true // nie przeskoczy na inny port po cichu
  }
});
