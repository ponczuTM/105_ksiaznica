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

    // Renderer (solid black background)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false, // <-- pełne, nieprzezroczyste tło
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.setClearColor(0x000000, 1); // <-- czarne tło na 100%

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    mount.appendChild(renderer.domElement);

    // Scene + Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // <-- dodatkowe zabezpieczenie

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 0, 14);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.05);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(6, 8, 10);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-8, -2, 8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.65);
    rim.position.set(0, 10, -10);
    scene.add(rim);

    const camLight = new THREE.PointLight(0xffffff, 0.9, 80);
    camLight.position.set(0, 0, 14);
    scene.add(camLight);

    // --- Planet (max 1) ---
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    // 2× większa planeta: promień 1.25 -> 2.5
    const sphereGeo = new THREE.SphereGeometry(2.5, 48, 48);

    let planetMesh = null;
    let planetSpeed = 0.0;
    let planetRotSpeed = 0.0;

    // Start trochę dalej (żeby większa planeta nie "wskakiwała" od razu w kadr)
    const startPos = new THREE.Vector3(-14.0, -7.2, -6.0);

    // Kierunek: lewy dół -> prawy góra
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

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        metalness: 0.06,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.32,
        emissiveMap: tex,
      });

      planetMesh = new THREE.Mesh(sphereGeo, mat);

      // Skala też 2× (względem Twojego poprzedniego zakresu)
      const scale = THREE.MathUtils.randFloat(1.9, 3.1); // było ~0.95–1.55
      planetMesh.scale.setScalar(scale);

      planetMesh.position.copy(startPos);
      planetMesh.position.x += THREE.MathUtils.randFloat(-1.2, 0.6);
      planetMesh.position.y += THREE.MathUtils.randFloat(-0.8, 0.9);
      planetMesh.position.z += THREE.MathUtils.randFloat(-3.0, 1.0);

      planetSpeed = THREE.MathUtils.randFloat(0.95, 1.35);
      planetRotSpeed = THREE.MathUtils.randFloat(0.22, 0.45);

      planetMesh.rotation.z = THREE.MathUtils.degToRad(
        THREE.MathUtils.randFloat(-18, 18)
      );
      planetMesh.rotation.x = THREE.MathUtils.degToRad(
        THREE.MathUtils.randFloat(-10, 10)
      );

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

      // Drift kamery (zostawiam – to nie jest tło ani gradient)
      camera.position.x = Math.sin(now * 0.00015) * 0.15;
      camera.position.y = Math.cos(now * 0.00012) * 0.12;
      camera.lookAt(0, 0, 0);

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
      sphereGeo.dispose();

      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [textures]);

  return <div ref={mountRef} className={className} />;
}
