/**
 * IntroScreen — 2001 / NASA mission-control overlay.
 *
 * The rotating satellite globe lives in <BackgroundGlobe> (App level); this is
 * a transparent UI layer that sits on top of it.
 *
 * Props:
 *   onStart    () => void   fired when INITIATE MISSION is pressed
 *   fading     bool         App sets this true during the launch transition
 *   poolCount  number       total cities in the database
 *   rounds     number       cities per mission (20)
 *   maxPts     number       max points per city (100)
 */
export default function IntroScreen({ onStart, fading, poolCount, rounds, maxPts }) {
  function handleClick() {
    if (fading) return;
    onStart();
  }

  return (
    <>
      {/* Dark radial vignette — pushes focus to the globe at center */}
      <div className="vignette-overlay" />

      {/* Intro content */}
      <div className="intro-screen" style={{ opacity: fading ? 0 : 1 }}>
        <p className="intro-eyebrow">Mission Control &mdash; Earth Station</p>

        <h1 className="intro-title">GeoPin</h1>

        <p className="intro-subtitle">World City Challenge</p>

        <div className="intro-stats">
          <div className="intro-stat">
            <span className="intro-stat-value">{rounds}</span>
            <span className="intro-stat-label">Cities</span>
          </div>
          <div className="intro-stat">
            <span className="intro-stat-value">{poolCount.toLocaleString()}</span>
            <span className="intro-stat-label">In Pool</span>
          </div>
          <div className="intro-stat">
            <span className="intro-stat-value">{maxPts}</span>
            <span className="intro-stat-label">Pts Max</span>
          </div>
        </div>

        <button className="btn-mission" onClick={handleClick}>
          Initiate Mission
        </button>
      </div>

      {/* Subtle CRT scanline overlay (sits above the UI for authenticity) */}
      <div className="crt-overlay" />
    </>
  );
}
