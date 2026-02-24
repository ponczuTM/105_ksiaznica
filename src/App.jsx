import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Viewer from "./pages/Viewer.jsx";
import Player from "./pages/Player.jsx";
import MainPage from "./pages/MainPage.jsx"
import Map from "./pages/Map.jsx";
import SendImage from "./pages/SendImage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage/>} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/player" element={<Player />} />
        <Route path="/map" element={<Map />} />
        <Route path="/sendimage" element={<SendImage />} />
      </Routes>
    </BrowserRouter>
  );
}
