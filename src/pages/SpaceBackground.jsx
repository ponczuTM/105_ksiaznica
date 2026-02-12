// SpaceBackground.jsx
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import sunFlat from "../assets/images/sun.jpg";
import earthFlat from "../assets/images/earth.jpg";
import marsFlat from "../assets/images/mars.jpg";

export default function SpaceBackground({ className }) {
  const mountRef = useRef(null);

  const textures = useMemo(() => [sunFlat, earthFlat, marsFlat], []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.setClearColor(0x000000, 0);

    // KLUCZ: kolor + tonemapping (robi “filmowo” i jaśniej)
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25; // <-- podbij / zbij (np. 1.1–1.5)

    mount.appendChild(renderer.domElement);

    // Scene + Camera
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 0, 14);

    // Lights (ważne dla StandardMaterial)
    const ambient = new THREE.AmbientLight(0xffffff, 1.05); // było 0.85
    scene.add(ambient);

    // Key light (główne)
    const key = new THREE.DirectionalLight(0xffffff, 1.15); // było 0.65
    key.position.set(6, 8, 10);
    scene.add(key);

    // Fill light (z drugiej strony, żeby nie było “czarnej połowy”)
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-8, -2, 8);
    scene.add(fill);

    // Rim light (kontur z tyłu – daje świetną czytelność)
    const rim = new THREE.DirectionalLight(0xffffff, 0.65);
    rim.position.set(0, 10, -10);
    scene.add(rim);

    // Light przy kamerze (żeby planeta zawsze była widoczna)
    const camLight = new THREE.PointLight(0xffffff, 0.9, 80);
    camLight.position.set(0, 0, 14);
    scene.add(camLight);

    // --- Starfield ---
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starPositions[i3 + 0] = THREE.MathUtils.randFloatSpread(60);
      starPositions[i3 + 1] = THREE.MathUtils.randFloatSpread(30);
      starPositions[i3 + 2] = THREE.MathUtils.randFloat(-80, 10);
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // --- Planet (max 1) ---
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    const sphereGeo = new THREE.SphereGeometry(1.25, 48, 48);

    let planetMesh = null;
    let planetSpeed = 0.0;
    let planetRotSpeed = 0.0;

    // START: lewy dół
    const startPos = new THREE.Vector3(-12.5, -6.2, -6.0);

    // Kierunek: lewy dół -> prawy góra (ok. +30°)
    const dirVec = new THREE.Vector3(1.0, 0.58, 0.0).normalize();

    let nextSpawnAt = performance.now() + 1200;

    const isOffscreen = (obj, margin = 0.15) => {
      const p = obj.position.clone();
      p.project(camera);
      return (
        p.x > 1 + margin ||
        p.x < -1 - margin ||
        p.y > 1 + margin ||
        p.y < -1 - margin
      );
    };

    const spawnPlanet = () => {
      if (planetMesh) return;

      const pick = textures[Math.floor(Math.random() * textures.length)];
      const tex = loader.load(pick);

      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;

      // KLUCZ: jaśniejszy, mniej matowy materiał + emissive
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,   // było 0.9 (za matowe)
        metalness: 0.06,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.32, // <-- podbij (0.2–0.5) jeśli chcesz “bardziej świecące”
        emissiveMap: tex,        // emissive z tej samej tekstury => tekstura zawsze czytelna
      });

      planetMesh = new THREE.Mesh(sphereGeo, mat);

      const scale = THREE.MathUtils.randFloat(0.95, 1.55);
      planetMesh.scale.setScalar(scale);

      planetMesh.position.copy(startPos);
      planetMesh.position.x += THREE.MathUtils.randFloat(-1.2, 0.6);
      planetMesh.position.y += THREE.MathUtils.randFloat(-0.8, 0.9);
      planetMesh.position.z += THREE.MathUtils.randFloat(-3.0, 1.0);

      planetSpeed = THREE.MathUtils.randFloat(0.95, 1.35);
      planetRotSpeed = THREE.MathUtils.randFloat(0.22, 0.45);

      planetMesh.rotation.z = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-18, 18));
      planetMesh.rotation.x = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-10, 10));

      scene.add(planetMesh);
    };

    const despawnPlanet = () => {
      if (!planetMesh) return;

      scene.remove(planetMesh);

      if (planetMesh.material?.map) planetMesh.material.map.dispose();
      if (planetMesh.material) planetMesh.material.dispose();

      planetMesh = null;
    };

    // Anim loop
    let raf = 0;
    let last = performance.now();

    const animate = (now) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      // Gwiazdy: efekt lotu
      const posAttr = stars.geometry.getAttribute("position");
      for (let i = 0; i < starCount; i++) {
        const zIndex = i * 3 + 2;
        posAttr.array[zIndex] += 10.5 * dt;
        if (posAttr.array[zIndex] > 10) {
          posAttr.array[zIndex] = THREE.MathUtils.randFloat(-85, -40);
        }
      }
      posAttr.needsUpdate = true;

      // Drift kamery
      camera.position.x = Math.sin(now * 0.00015) * 0.15;
      camera.position.y = Math.cos(now * 0.00012) * 0.12;
      camera.lookAt(0, 0, 0);

      // camera light podąża za kamerą
      camLight.position.copy(camera.position);

      // Spawn
      if (!planetMesh && now >= nextSpawnAt) {
        spawnPlanet();
      }

      // Ruch + obrót
      if (planetMesh) {
        planetMesh.position.addScaledVector(dirVec, planetSpeed * dt);

        planetMesh.position.x += Math.sin(now * 0.0011) * 0.002;
        planetMesh.position.y += Math.cos(now * 0.0010) * 0.002;

        planetMesh.rotation.y += planetRotSpeed * dt;
        planetMesh.rotation.x += 0.08 * dt;

        if (isOffscreen(planetMesh, 0.22)) {
          despawnPlanet();
          const pauseMs = THREE.MathUtils.randInt(1200, 3200);
          nextSpawnAt = now + pauseMs;
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    // Resize
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();

      despawnPlanet();

      starGeo.dispose();
      starMat.dispose();
      sphereGeo.dispose();

      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [textures]);

  return <div ref={mountRef} className={className} />;
}
