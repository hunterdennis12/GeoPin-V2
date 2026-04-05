import { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';

/** Paints ~200 randomly-placed stars onto a fixed canvas. */
function StarField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Generate star data once
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
    }));

    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;
      for (const s of stars) {
        const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="star-canvas" />;
}

/** Small auto-rotating Globe.gl used purely as a visual on the intro screen. */
function IntroGlobe() {
  const mountRef = useRef(null);
  const globeRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || globeRef.current) return;

    const g = Globe()(el);
    globeRef.current = g;

    g.width(280)
     .height(280)
     .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
     .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
     .backgroundImageUrl(null)        // transparent — star canvas shows through
     .atmosphereColor('#1B4FD8')
     .atmosphereAltitude(0.18)
     .enablePointerInteraction(false); // no drag on intro globe

    // Make the scene background transparent
    const renderer = g.renderer();
    if (renderer) {
      renderer.setClearColor(0x000000, 0);
    }

    // Point camera at a nice angle
    g.pointOfView({ lat: 20, lng: 10, altitude: 2.0 });

    // Auto-rotate via animation loop
    let animId;
    let lng = 10;
    function rotate() {
      lng -= 0.12;
      g.pointOfView({ lat: 20, lng, altitude: 2.0 });
      animId = requestAnimationFrame(rotate);
    }
    // Start after a short delay so the globe textures have time to load
    const timer = setTimeout(() => { rotate(); }, 300);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer);
      // Globe.gl attaches a canvas — clean it up
      while (el.firstChild) el.removeChild(el.firstChild);
      globeRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: 280,
        height: 280,
        position: 'relative',
        background: 'transparent',
      }}
    />
  );
}

/**
 * IntroScreen
 * Props:
 *   onStart — called when the player clicks "INITIATE MISSION"
 */
export default function IntroScreen({ onStart }) {
  const [fading, setFading] = useState(false);

  function handleClick() {
    if (fading) return;
    setFading(true);
    // Let the fade-to-black overlay complete before calling onStart
    setTimeout(onStart, 1500);
  }

  return (
    <>
      {/* Star field — fixed, behind everything */}
      <StarField />

      {/* Black fade overlay — activated when transitioning */}
      <div className={`fade-overlay${fading ? ' active' : ''}`} />

      {/* Main intro content */}
      <div className="intro-screen" style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.8s ease' }}>

        <p className="intro-tagline">
          An epic journey of adventure and exploration
        </p>

        <p className="intro-subtitle-top">
          Test your knowledge of Earth&apos;s great cities
        </p>

        {/* Auto-rotating globe */}
        <div className="intro-globe-wrapper">
          <IntroGlobe />
        </div>

        <h1 className="intro-title">GeoPin</h1>

        <p className="intro-subtitle-bottom">
          Geographic Intelligence Assessment
        </p>

        <button className="btn-mission" onClick={handleClick}>
          [ Initiate Mission ]
        </button>
      </div>
    </>
  );
}
