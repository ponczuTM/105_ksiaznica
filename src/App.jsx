import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Viewer from "./pages/Viewer.jsx";
import Player from "./pages/Player.jsx";
import MainPage from "./pages/MainPage.jsx"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage/>} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/player" element={<Player />} />
      </Routes>
    </BrowserRouter>
  );
}
