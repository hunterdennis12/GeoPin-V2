import { useState, useCallback } from 'react';
import './index.css';

import { ALL_CITIES } from './data/cities.js';
import { haversineDistance, calculateScore } from './utils/haversine.js';

import IntroScreen from './components/IntroScreen.jsx';
import GlobeView from './components/GlobeView.jsx';
import HUD from './components/HUD.jsx';
import ResultPanel from './components/ResultPanel.jsx';
import ResultsScreen from './components/ResultsScreen.jsx';

const ROUNDS_PER_GAME = 20;

/** Pick `n` random cities, no duplicates. */
function pickCities(n) {
  const shuffled = [...ALL_CITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * App — top-level state machine.
 *
 * Screens:
 *   'intro'   → IntroScreen
 *   'game'    → GlobeView + HUD + ResultPanel
 *   'results' → ResultsScreen
 */
export default function App() {
  const [screen, setScreen] = useState('intro');

  // ── Game state ──────────────────────────────────────────────────────────
  const [cities, setCities] = useState([]);           // 20 cities for this round
  const [roundIndex, setRoundIndex] = useState(0);    // 0-based current city index
  const [scores, setScores] = useState([]);           // { city, score, distance, guessLat, guessLng } per round
  const [totalScore, setTotalScore] = useState(0);

  // ── Round state ─────────────────────────────────────────────────────────
  const [guessLocked, setGuessLocked] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasGuessedOnce, setHasGuessedOnce] = useState(false); // hides hint after first guess
  const [guessCoords, setGuessCoords] = useState(null);        // { lat, lng }

  // ─── Start a new game ──────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const newCities = pickCities(ROUNDS_PER_GAME);
    setCities(newCities);
    setRoundIndex(0);
    setScores([]);
    setTotalScore(0);
    setGuessLocked(false);
    setPanelOpen(false);
    setHasGuessedOnce(false);
    setGuessCoords(null);
    setScreen('game');
  }, []);

  // ─── Handle a guess from the globe ────────────────────────────────────
  const handleGuess = useCallback((lat, lng) => {
    if (guessLocked) return;

    const city = cities[roundIndex];
    const distance = haversineDistance(lat, lng, city.lat, city.lng);
    const score = calculateScore(distance);
    const countryName = city.country; // ISO code — pretty names can be added later

    const roundResult = {
      city: { ...city, countryName },
      score,
      distance: Math.round(distance),
      guessLat: lat,
      guessLng: lng,
    };

    setGuessCoords({ lat, lng });
    setGuessLocked(true);
    setHasGuessedOnce(true);
    setScores((prev) => [...prev, roundResult]);
    setTotalScore((prev) => prev + score);

    // Slight delay before sliding panel in, so the arc has time to draw
    setTimeout(() => setPanelOpen(true), 800);
  }, [guessLocked, cities, roundIndex]);

  // ─── Advance to next round ─────────────────────────────────────────────
  const handleNext = useCallback(() => {
    setPanelOpen(false);

    // Give panel time to slide out before resetting
    setTimeout(() => {
      if (roundIndex + 1 >= ROUNDS_PER_GAME) {
        setScreen('results');
      } else {
        setRoundIndex((i) => i + 1);
        setGuessLocked(false);
        setGuessCoords(null);
      }
    }, 450);
  }, [roundIndex]);

  // ─── Play again ────────────────────────────────────────────────────────
  const handlePlayAgain = useCallback(() => {
    startGame();
  }, [startGame]);

  // ─── Dev-mode test helper (removed in production builds via tree-shaking) ──
  if (import.meta.env.DEV && screen === 'game' && cities.length) {
    window.__testGuess = (lat = 0, lng = 0) => handleGuess(lat, lng);
    window.__testSkipToResults = () => {
      // Fast-forward: push fake scores for remaining rounds then show results
      const remaining = cities.slice(scores.length);
      const fakeScores = remaining.map(city => ({
        city: { ...city, countryName: city.country },
        score: Math.floor(Math.random() * 100),
        distance: Math.floor(Math.random() * 9000),
        guessLat: city.lat + 5,
        guessLng: city.lng + 5,
      }));
      setScores(prev => [...prev, ...fakeScores]);
      setTotalScore(prev => prev + fakeScores.reduce((s, r) => s + r.score, 0));
      setScreen('results');
    };
  }

  // ─── Computed helpers ──────────────────────────────────────────────────
  const currentCity = cities[roundIndex] || null;
  const currentResult = scores[scores.length - 1] || null;
  const isFinalRound = roundIndex === ROUNDS_PER_GAME - 1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>

      {/* ── Intro ───────────────────────────────────────────────────────── */}
      {screen === 'intro' && (
        <IntroScreen onStart={startGame} />
      )}

      {/* ── Game ────────────────────────────────────────────────────────── */}
      {screen === 'game' && currentCity && (
        <>
          <GlobeView
            currentCity={currentCity}
            guessLocked={guessLocked}
            guessCoords={guessCoords}
            onGuess={handleGuess}
          />
          <HUD
            roundIndex={roundIndex}
            totalRounds={ROUNDS_PER_GAME}
            totalScore={totalScore}
            scores={scores}
            currentCity={currentCity}
            guessLocked={guessLocked}
            hasGuessedOnce={hasGuessedOnce}
          />
          <ResultPanel
            isOpen={panelOpen}
            result={currentResult}
            totalScore={totalScore}
            isFinalRound={isFinalRound}
            onNext={handleNext}
          />
        </>
      )}

      {/* ── Final Results ────────────────────────────────────────────────── */}
      {screen === 'results' && (
        <ResultsScreen
          scores={scores}
          totalScore={totalScore}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
