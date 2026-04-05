import { useEffect, useState } from 'react';
import { scoreColor } from '../utils/haversine.js';

/**
 * Grade table — score out of 2000.
 */
function getGrade(total) {
  if (total >= 1800) return 'CARTOGRAPHER';
  if (total >= 1500) return 'NAVIGATOR';
  if (total >= 1200) return 'EXPLORER';
  if (total >= 900)  return 'TRAVELER';
  if (total >= 600)  return 'TOURIST';
  return 'LOST IN SPACE';
}

/**
 * ResultsScreen — shown after all 20 rounds.
 *
 * Props:
 *   scores      [{ city, score, distance }]
 *   totalScore  number
 *   onPlayAgain () => void
 */
export default function ResultsScreen({ scores, totalScore, onPlayAgain }) {
  const maxScore = scores.length * 100;   // 2000
  const grade    = getGrade(totalScore);

  // Animate the score bar filling in
  const [barPct, setBarPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setBarPct((totalScore / 2000) * 100), 200);
    return () => clearTimeout(t);
  }, [totalScore]);

  return (
    <div className="results-screen">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="results-header">
        <div className="results-mission-complete">Mission Complete</div>

        <div className="results-final-score">
          {totalScore.toLocaleString()} / {maxScore.toLocaleString()}
        </div>

        <div className="results-grade">{grade}</div>

        {/* Animated score bar */}
        <div className="results-score-bar-track">
          <div className="results-score-bar-fill" style={{ width: `${barPct}%` }} />
        </div>
      </div>

      {/* ── City breakdown ────────────────────────────────────────────── */}
      <div className="results-breakdown">
        <div className="results-breakdown-title">City Breakdown</div>

        {scores.map((r, i) => {
          const color = scoreColor(r.score);
          return (
            <div key={i} className="results-city-row">
              <span className="results-city-name">
                {i + 1}. {r.city.name}, {r.city.countryName || r.city.country}
              </span>
              <span className="results-city-score" style={{ color }}>
                {r.score} / 100
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Play again ───────────────────────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <button className="btn-mission" onClick={onPlayAgain}>
          [ Initiate New Mission ]
        </button>
      </div>
    </div>
  );
}
