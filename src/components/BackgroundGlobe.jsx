import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ── Tile config: Esri World Imagery, zoom 3 → 8×8 = 64 tiles → 2048² ────── */
const TILE_Z = 3;
const TILES_PER_SIDE = 1 << TILE_Z;        // 8
const TILE_PX = 256;
const TEX_PX = TILES_PER_SIDE * TILE_PX;   // 2048
const TILE_URL = (z, y, x) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

/* ── Camera distances ───────────────────────────────────────────────────── */
const START_DIST = 2.8;
const END_DIST = 1.05;
const ZOOM_MS = 1750;

/* ── A handful of major cities for the night-side golden lights ──────────── */
const CITY_LIGHTS = [
  [40.71, -74.01], [34.05, -118.24], [41.88, -87.63], [19.43, -99.13],
  [-23.55, -46.63], [-34.6, -58.38], [4.71, -74.07], [51.51, -0.13],
  [48.86, 2.35], [40.42, -3.7], [41.9, 12.5], [52.52, 13.4],
  [55.76, 37.62], [41.01, 28.98], [30.04, 31.24], [-26.2, 28.04],
  [6.52, 3.38], [-1.29, 36.82], [25.2, 55.27], [35.69, 139.69],
  [37.57, 126.98], [39.9, 116.4], [31.23, 121.47], [22.32, 114.17],
  [1.35, 103.82], [13.76, 100.5], [-6.21, 106.85], [28.61, 77.21],
  [19.08, 72.88], [24.86, 67.0], [-33.87, 151.21], [-37.81, 144.96],
  [31.95, 35.93], [33.69, 73.05], [14.6, 120.98], [3.14, 101.69],
  [-12.05, -77.04], [10.49, -66.88], [45.42, -75.7], [43.65, -79.38],
  [29.76, -95.37], [37.77, -122.42], [47.61, -122.33], [38.9, -77.04],
];

function latLngToVec3(lat, lng, r) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * BackgroundGlobe — persistent full-screen Three.js globe behind every screen.
 *
 * Props:
 *   interactive  bool  enable drag-to-rotate / pinch-to-zoom (intro only)
 *   active       bool  run the render loop (paused once the game owns the screen)
 *
 * Ref API:
 *   launch()  → Promise that resolves once the zoom-in finishes
 */
const BackgroundGlobe = forwardRef(function BackgroundGlobe(
  { interactive = true, active = true },
  ref,
) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  // ── Build the scene once ──────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x00000a, 1);

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
    camera.position.set(0, 0, START_DIST);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // ── Satellite texture canvas (deep-ocean placeholder + progressive tiles)
    const texCanvas = document.createElement('canvas');
    texCanvas.width = texCanvas.height = TEX_PX;
    const tctx = texCanvas.getContext('2d');
    tctx.fillStyle = '#0a2744'; // deep ocean blue, visible immediately
    tctx.fillRect(0, 0, TEX_PX, TEX_PX);
    const earthTex = new THREE.CanvasTexture(texCanvas);
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;

    const loadedImages = [];
    for (let y = 0; y < TILES_PER_SIDE; y++) {
      for (let x = 0; x < TILES_PER_SIDE; x++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          tctx.drawImage(img, x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
          earthTex.needsUpdate = true;
        };
        img.onerror = () => {};
        img.src = TILE_URL(TILE_Z, y, x);
        loadedImages.push(img);
      }
    }

    // ── Earth sphere ──────────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex,
      specular: new THREE.Color(0x2a4a6a),
      shininess: 14,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earth);

    // ── Lighting: sun from upper-left + low ambient (night side stays dark) ─
    const ambient = new THREE.AmbientLight(0x5577aa, 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff4e6, 1.25);
    sun.position.set(-1, 0.85, 0.9);
    scene.add(sun);
    const sunDir = sun.position.clone().normalize();

    // ── Atmosphere rim glow ───────────────────────────────────────────────
    const atmoGeo = new THREE.SphereGeometry(1.16, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0x4a8fcc) } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
          gl_FragColor = vec4(uColor * rim, rim);
        }`,
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);

    // ── Night-side city lights ────────────────────────────────────────────
    const cityPos = new Float32Array(CITY_LIGHTS.length * 3);
    const cityPhase = new Float32Array(CITY_LIGHTS.length);
    CITY_LIGHTS.forEach(([lat, lng], i) => {
      const v = latLngToVec3(lat, lng, 1.008);
      cityPos[i * 3] = v.x;
      cityPos[i * 3 + 1] = v.y;
      cityPos[i * 3 + 2] = v.z;
      cityPhase[i] = Math.random() * 6.283;
    });
    const cityGeo = new THREE.BufferGeometry();
    cityGeo.setAttribute('position', new THREE.BufferAttribute(cityPos, 3));
    cityGeo.setAttribute('aPhase', new THREE.BufferAttribute(cityPhase, 1));
    const cityMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: sunDir },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          float night = clamp(-dot(normalize(worldPos), uSunDir), 0.0, 1.0);
          float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + aPhase);
          vAlpha = smoothstep(0.05, 0.5, night) * twinkle;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 4.0 * uPixelRatio;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(1.0, 0.82, 0.45, glow * vAlpha);
        }`,
    });
    const cityLights = new THREE.Points(cityGeo, cityMat);
    earthGroup.add(cityLights);

    // ── Star field (8,500 points, subtle twinkle) ─────────────────────────
    const STAR_COUNT = 8500;
    const starPos = new Float32Array(STAR_COUNT * 3);
    const starPhase = new Float32Array(STAR_COUNT);
    const starSize = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      // uniform direction on a sphere shell
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 120 + Math.random() * 60;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
      starPhase[i] = Math.random() * 6.283;
      starSize[i] = 0.8 + Math.random() * 1.8;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vTw;
        void main() {
          vTw = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 1.4 + aPhase));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vTw;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          if (length(c) > 0.5) discard;
          gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), vTw);
        }`,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Controls (touch drag + pinch zoom on mobile) ──────────────────────
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.6;
    controls.minDistance = 1.6;
    controls.maxDistance = 4.0;
    controls.enabled = interactive;

    // ── Sizing ────────────────────────────────────────────────────────────
    function resize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Animation loop ────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;
    let rotationFactor = 1;        // 1 = full speed, 0 = stopped (during launch)
    const ROT_SPEED = (2 * Math.PI) / 40; // ~40s per revolution

    // launch animation state
    let zooming = false;
    let zoomStart = 0;
    let zoomFromDist = START_DIST;
    let zoomDir = new THREE.Vector3(0, 0, 1);
    let zoomResolve = null;

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      earthGroup.rotation.y += ROT_SPEED * dt * rotationFactor;

      cityMat.uniforms.uTime.value = t;
      starMat.uniforms.uTime.value = t;

      if (zooming) {
        const p = Math.min(1, (performance.now() - zoomStart) / ZOOM_MS);
        const e = easeInOutCubic(p);
        const dist = zoomFromDist + (END_DIST - zoomFromDist) * e;
        camera.position.copy(zoomDir).multiplyScalar(dist);
        camera.lookAt(0, 0, 0);
        rotationFactor = 1 - e;          // spin slows to a stop
        if (p >= 1) {
          zooming = false;
          rotationFactor = 0;
          const r = zoomResolve;
          zoomResolve = null;
          r && r();
        }
      } else if (controls.enabled) {
        controls.update();
      }

      renderer.render(scene, camera);
    }

    function start() {
      if (running) return;
      running = true;
      clock.getDelta(); // reset delta so we don't jump
      frame();
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    // Expose imperative API
    apiRef.current = {
      start,
      stop,
      setInteractive(v) { controls.enabled = v; },
      launch() {
        return new Promise((resolve) => {
          controls.enabled = false;
          zoomFromDist = camera.position.length() || START_DIST;
          zoomDir = camera.position.clone().normalize();
          if (zoomDir.lengthSq() === 0) zoomDir.set(0, 0, 1);
          zoomStart = performance.now();
          zooming = true;
          zoomResolve = resolve;
          start();
        });
      },
    };

    start();

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      controls.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      earthTex.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      cityGeo.dispose();
      cityMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      loadedImages.forEach((img) => { img.onload = null; img.onerror = null; });
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── React to prop changes ─────────────────────────────────────────────
  useEffect(() => {
    apiRef.current?.setInteractive(interactive);
  }, [interactive]);

  useEffect(() => {
    if (active) apiRef.current?.start();
    else apiRef.current?.stop();
  }, [active]);

  useImperativeHandle(ref, () => ({
    launch: () => apiRef.current?.launch() ?? Promise.resolve(),
  }), []);

  return (
    <div
      ref={containerRef}
      className={`globe-canvas${interactive ? ' interactive' : ''}`}
    />
  );
});

export default BackgroundGlobe;
