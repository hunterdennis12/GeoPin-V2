import { useEffect, useState, useRef } from 'react';
import { fetchWikiSummary, fetchCityImages, parseExtract } from '../utils/wikipedia.js';
import { scoreColor } from '../utils/haversine.js';

/**
 * ResultPanel — slides in from the right after a guess is locked.
 *
 * Props:
 *   isOpen       bool
 *   result       { city, score, distance, guessLat, guessLng } | null
 *   totalScore   number
 *   isFinalRound bool
 *   onNext       () => void
 */
export default function ResultPanel({ isOpen, result, totalScore, isFinalRound, onNext }) {
  const [wikiData,   setWikiData]   = useState(null);   // { historical, economic, cultural, funFact }
  const [images,     setImages]     = useState([]);
  const [wikiLoading, setWikiLoading] = useState(false);

  // Track which city we last fetched for — avoid redundant re-fetches
  const lastFetchedCity = useRef(null);

  // Animated score bar width
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    if (!isOpen || !result) { setBarWidth(0); return; }
    const t = setTimeout(() => setBarWidth(result.score), 50);
    return () => clearTimeout(t);
  }, [isOpen, result]);

  // Fetch Wikipedia data when panel opens with a new city
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

  const color = result ? scoreColor(result.score) : '#fff';

  return (
    <div className={`result-panel${isOpen ? ' open' : ''}`}>
      {result && (
        <>
          {/* ── Section 1: Score summary ─────────────────────────────── */}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 2 }}>
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

            {/* Animated score bar */}
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${barWidth}%`,
                  background: color,
                }}
              />
            </div>
          </div>

          <div className="panel-divider" />

          {/* ── Section 2: City info ─────────────────────────────────── */}
          <div style={{ flex: 1 }}>

            {/* Image strip */}
            <ImageStrip images={images} cityName={result.city.name} />

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wikiLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div className="spinner-ring" style={{ margin: '0 auto' }} />
                  <div className="spinner-text" style={{ marginTop: 8 }}>Loading data...</div>
                </div>
              ) : wikiData ? (
                <>
                  <WikiSection label="Historical Overview" text={wikiData.historical} />
                  <div className="panel-divider" />
                  <WikiSection label="Economic Overview"   text={wikiData.economic} />
                  <div className="panel-divider" />
                  <WikiSection label="Cultural Overview"   text={wikiData.cultural} />
                  <div className="panel-divider" />
                  <WikiSection label="Fun Fact"            text={wikiData.funFact} />
                </>
              ) : (
                <div className="wiki-section-text" style={{ color: 'var(--color-dim)' }}>
                  Data unavailable.
                </div>
              )}
            </div>
          </div>

          <div className="panel-divider" />

          {/* ── Next button ──────────────────────────────────────────── */}
          <button className="btn-mission" onClick={onNext} style={{ width: '100%', textAlign: 'center' }}>
            {isFinalRound ? '[ See Final Results →]' : '[ Next City → ]'}
          </button>
        </>
      )}
    </div>
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

function ImageStrip({ images, cityName }) {
  return (
    <div className="image-strip">
      {[0, 1, 2].map((i) => (
        <div key={i} className="image-tile">
          {images[i] ? (
            <img
              src={images[i]}
              alt={`${cityName} ${i + 1}`}
              onError={(e) => {
                // Hide broken images and show placeholder
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = 'flex');
              }}
            />
          ) : null}
          <div
            className="image-tile-placeholder"
            style={{ display: images[i] ? 'none' : 'flex' }}
          >
            {cityName}
          </div>
        </div>
      ))}
    </div>
  );
}
