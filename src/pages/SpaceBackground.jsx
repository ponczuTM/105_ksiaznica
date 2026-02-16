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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // canvas ma wypełniać kontener
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(0, 0, 10);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(6, 8, 10);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(-8, -2, 8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(0, 10, -10);
    scene.add(rim);

    const camLight = new THREE.PointLight(0xffffff, 0.8, 80);
    camLight.position.copy(camera.position);
    scene.add(camLight);

    // --- Planet (max 1) ---
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    // ZMNIEJSZONA geometria (Twoja była monstrualna)
    const sphereGeo = new THREE.SphereGeometry(1.5, 48, 48);

    let planetMesh = null;
    let planetSpeed = 0.0;
    let planetRotSpeed = 0.0;

    // Start bliżej kadru
    const startPos = new THREE.Vector3(-9.5, -4.8, -2.0);
    const dirVec = new THREE.Vector3(1.0, 0.58, 0.0).normalize();

    let nextSpawnAt = performance.now() + 600;

    const spawnPlanet = () => {
      if (planetMesh) return;

      const pick = textures[Math.floor(Math.random() * textures.length)];
      const tex = loader.load(pick);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        metalness: 0.06,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.22,
        emissiveMap: tex,
      });

      planetMesh = new THREE.Mesh(sphereGeo, mat);

      // Rozsądna skala – zawsze widać, ale nie zasłania pół ekranu
      const scale = THREE.MathUtils.randFloat(3, 3);
      planetMesh.scale.setScalar(scale);

      planetMesh.position.copy(startPos);
      planetMesh.position.x += THREE.MathUtils.randFloat(-0.8, 0.6);
      planetMesh.position.y += THREE.MathUtils.randFloat(-0.6, 0.8);
      planetMesh.position.z += THREE.MathUtils.randFloat(-2.0, 1.0);

      planetSpeed = THREE.MathUtils.randFloat(1.6, 2.4); // szybciej, żeby realnie przelatywała
      planetRotSpeed = THREE.MathUtils.randFloat(0.18, 0.35);

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

    const isOffscreen = (obj, margin = 0.25) => {
      const p = obj.position.clone().project(camera);
      return (
        p.x > 1 + margin ||
        p.x < -1 - margin ||
        p.y > 1 + margin ||
        p.y < -1 - margin
      );
    };

    // Sizing zawsze z viewportu
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // Anim loop
    let raf = 0;
    let last = performance.now();

    const animate = (now) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      // delikatny drift
      camera.position.x = Math.sin(now * 0.00015) * 0.12;
      camera.position.y = Math.cos(now * 0.00012) * 0.10;
      camera.lookAt(0, 0, 0);

      camLight.position.copy(camera.position);

      if (!planetMesh && now >= nextSpawnAt) spawnPlanet();

      if (planetMesh) {
        planetMesh.position.addScaledVector(dirVec, planetSpeed * dt);
        planetMesh.rotation.y += planetRotSpeed * dt;
        planetMesh.rotation.x += 0.06 * dt;

        if (isOffscreen(planetMesh, 0.28)) {
          despawnPlanet();
          nextSpawnAt = now + THREE.MathUtils.randInt(800, 2200);
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);

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
