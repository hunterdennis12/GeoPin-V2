import { useEffect, useState } from 'react';
import { countryName } from '../utils/countries.js';

/**
 * HUD — fixed overlay on top of the game globe.
 *
 * Props:
 *   roundIndex     number   0-based current round
 *   totalRounds    number   20
 *   totalScore     number   running total
 *   scores         array    results so far (length === roundIndex when locked)
 *   currentCity    { name, country }
 *   guessLocked    bool
 *   hasGuessedOnce bool     hides the click-hint after first guess
 */
export default function HUD({
  roundIndex,
  totalRounds,
  totalScore,
  scores,
  currentCity,
  guessLocked,
  hasGuessedOnce,
}) {
  // Animate city name in on each new city
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [currentCity?.name]);

  const cityNumber   = roundIndex + 1;
  const completedDots = scores.length; // dots filled = rounds with a locked score

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="hud-bar">
        <div className="hud-top-row">
          <span className="hud-logo">GeoPin</span>
          <span className="hud-counter">City {cityNumber} / {totalRounds}</span>
          <span className="hud-score">Score <b>{totalScore.toLocaleString()}</b></span>
        </div>

        {/* Progress dots */}
        <div className="hud-dots">
          {Array.from({ length: totalRounds }, (_, i) => (
            <div
              key={i}
              className={`hud-dot${i < completedDots ? ' filled' : ''}`}
              title={i < completedDots ? `Round ${i + 1}: ${scores[i]?.score ?? 0}/100` : `Round ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── City prompt ─────────────────────────────────────────────────── */}
      {currentCity && (
        <div
          className="city-prompt"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          <div className="city-prompt-label">Locate this city:</div>
          <div className="city-prompt-name">{currentCity.name}</div>
          <div className="city-prompt-country">{countryName(currentCity.country)}</div>
          {!hasGuessedOnce && !guessLocked && (
            <div className="city-prompt-hint">Click the globe to place your pin</div>
          )}
        </div>
      )}
    </>
  );
}
