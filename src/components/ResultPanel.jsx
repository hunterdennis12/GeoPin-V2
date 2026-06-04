import { useEffect, useState, useRef } from 'react';
import { fetchWikiSummary, fetchCityImages, parseExtract } from '../utils/wikipedia.js';
import { scoreColor } from '../utils/haversine.js';

/**
 * ResultPanel — slides in after a guess is locked.
 *   Desktop: right sidebar.
 *   Mobile:  bottom sheet that opens collapsed (keeping the map large) and can
 *            be dragged / tapped up and down via the handle.
 *
 * Props:
 *   isOpen, result, totalScore, isFinalRound, onNext
 */
export default function ResultPanel({ isOpen, result, totalScore, isFinalRound, onNext }) {
  const [wikiData, setWikiData] = useState(null);
  const [images, setImages] = useState([]);
  const [wikiLoading, setWikiLoading] = useState(false);
  const lastFetchedCity = useRef(null);

  const [expanded, setExpanded] = useState(false);     // mobile sheet
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [barWidth, setBarWidth] = useState(0);

  // Collapse the sheet + close any photo each time the panel opens for a city
  useEffect(() => {
    if (isOpen) { setExpanded(false); setLightboxIndex(null); }
  }, [isOpen, result?.city?.name]);

  // Animated score bar
  useEffect(() => {
    if (!isOpen || !result) { setBarWidth(0); return; }
    const t = setTimeout(() => setBarWidth(result.score), 50);
    return () => clearTimeout(t);
  }, [isOpen, result]);

  // Fetch Wikipedia data when the panel opens for a new city
  useEffect(() => {
    if (!isOpen || !result) return;
    const cityName = result.city.name;
    if (lastFetchedCity.current === cityName) return;
    lastFetchedCity.current = cityName;

    setWikiData(null);
    setImages([]);
    setWikiLoading(true);

    const country = result.city.countryName || result.city.country;

    Promise.all([
      fetchWikiSummary(cityName, country),
      fetchCityImages(cityName),
    ]).then(([summary, imgs]) => {
      setWikiData(parseExtract(summary?.extract || null));
      setImages(imgs || []);
      setWikiLoading(false);
    }).catch(() => {
      setWikiData(parseExtract(null));
      setImages([]);
      setWikiLoading(false);
    });
  }, [isOpen, result]);

  // ── Sheet drag handle (tap to toggle, drag up/down to expand/collapse) ──
  const touch = useRef({ y: 0, moved: false });
  const onHandleTouchStart = (e) => { touch.current = { y: e.touches[0].clientY, moved: false }; };
  const onHandleTouchMove = (e) => {
    if (Math.abs(e.touches[0].clientY - touch.current.y) > 8) touch.current.moved = true;
  };
  const onHandleTouchEnd = (e) => {
    if (!touch.current.moved) return;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (dy < -25) setExpanded(true);
    else if (dy > 25) setExpanded(false);
  };
  const onHandleClick = () => {
    if (touch.current.moved) { touch.current.moved = false; return; }
    setExpanded((v) => !v);
  };

  // ── Photo gallery (lightbox) ──────────────────────────────────────────
  const swipeX = useRef(0);
  const galleryOpen = lightboxIndex !== null && images[lightboxIndex];
  const goPhoto = (dir) =>
    setLightboxIndex((i) => (i + dir + images.length) % images.length);
  const onStageTouchStart = (e) => { swipeX.current = e.touches[0].clientX; };
  const onStageTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - swipeX.current;
    if (images.length > 1) {
      if (dx > 40) goPhoto(-1);
      else if (dx < -40) goPhoto(1);
    }
  };

  const color = result ? scoreColor(result.score) : '#fff';

  // Build the overview sections, hiding empty ones (economic always shows)
  const sections = [];
  if (result) {
    if (wikiData?.historical)
      sections.push(<WikiSection key="h" label="Historical Overview" text={wikiData.historical} />);
    sections.push(
      <div className="wiki-section" key="e">
        <div className="wiki-section-label">Economic Overview</div>
        <div className="wiki-section-text">
          {result.city.population ? (
            <div className="population-line">
              Population: {result.city.population.toLocaleString()}
            </div>
          ) : null}
          {wikiData?.economic}
        </div>
      </div>,
    );
    if (wikiData?.cultural)
      sections.push(<WikiSection key="c" label="Cultural Overview" text={wikiData.cultural} />);
    if (wikiData?.funFact)
      sections.push(<WikiSection key="f" label="Fun Fact" text={wikiData.funFact} />);
  }

  return (
    <>
      <div className={`result-panel${isOpen ? ' open' : ''}${expanded ? ' expanded' : ''}`}>
        {/* Mobile drag handle */}
        <div
          className="sheet-handle"
          onClick={onHandleClick}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="sheet-handle-bar" />
          <div className="sheet-handle-hint">{expanded ? 'Drag down for map' : 'Drag up for details'}</div>
        </div>

        {result && (
          <div className="result-panel-body">
            {/* ── Score summary ──────────────────────────────────────── */}
            <div>
              <div className="panel-city-name">
                {result.city.name}, {result.city.countryName || result.city.country}
              </div>
              <div className="panel-divider" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Row label="Your guess" value={`${result.distance.toLocaleString()} km off`} />
                <Row
                  label="Proximity score"
                  value={`${result.score} / 100`}
                  valueStyle={{ color, fontWeight: 700, fontSize: 16 }}
                />
                <Row label="Running total" value={`${totalScore.toLocaleString()} / 2,000`} />
              </div>

              <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${barWidth}%`, background: color }} />
              </div>
            </div>

            <div className="panel-divider" />

            {/* ── City info ──────────────────────────────────────────── */}
            <div style={{ flex: 1 }}>
              <ImageStrip images={images} cityName={result.city.name} onExpand={setLightboxIndex} />

              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wikiLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div className="spinner-ring" style={{ margin: '0 auto' }} />
                    <div className="spinner-text" style={{ marginTop: 8 }}>Loading data...</div>
                  </div>
                ) : (
                  sections.reduce((acc, s, i) => {
                    if (i > 0) acc.push(<div className="panel-divider" key={`d${i}`} />);
                    acc.push(s);
                    return acc;
                  }, [])
                )}
              </div>
            </div>

            <div className="panel-divider" />

            <button className="btn-mission" onClick={onNext} style={{ width: '100%', textAlign: 'center' }}>
              {isFinalRound ? 'Final Results' : 'Next City'}
            </button>
          </div>
        )}
      </div>

      {/* ── Photo gallery lightbox ───────────────────────────────────── */}
      {galleryOpen && (
        <div className="lightbox" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Close">
            &times;
          </button>
          <div
            className="lightbox-stage"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onStageTouchStart}
            onTouchEnd={onStageTouchEnd}
          >
            {images.length > 1 && (
              <button className="lightbox-nav prev" onClick={() => goPhoto(-1)} aria-label="Previous">
                &#8249;
              </button>
            )}
            <img src={images[lightboxIndex]} alt="" />
            {images.length > 1 && (
              <button className="lightbox-nav next" onClick={() => goPhoto(1)} aria-label="Next">
                &#8250;
              </button>
            )}
          </div>
          {images.length > 1 && (
            <div className="lightbox-dots">
              {images.map((_, i) => (
                <span key={i} className={`lightbox-dot${i === lightboxIndex ? ' active' : ''}`} />
              ))}
            </div>
          )}
          <div className="lightbox-hint">
            {images.length > 1 ? 'Swipe or use arrows · tap outside to close' : 'Tap outside to close'}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Small sub-components ──────────────────────────────────────────────── */

function Row({ label, value, valueStyle = {} }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span className="panel-label">{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}

function WikiSection({ label, text }) {
  return (
    <div className="wiki-section">
      <div className="wiki-section-label">{label}</div>
      <div className="wiki-section-text">{text}</div>
    </div>
  );
}

function ImageStrip({ images, cityName, onExpand }) {
  return (
    <div className="image-strip">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`image-tile${images[i] ? ' clickable' : ''}`}
          onClick={images[i] ? () => onExpand(i) : undefined}
        >
          {images[i] ? (
            <img
              src={images[i]}
              alt={`${cityName} ${i + 1}`}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = 'flex');
              }}
            />
          ) : null}
          <div className="image-tile-placeholder" style={{ display: images[i] ? 'none' : 'flex' }}>
            {cityName}
          </div>
        </div>
      ))}
    </div>
  );
}
