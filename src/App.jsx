import { useState, useCallback, useRef } from 'react';
import './index.css';

import { ALL_CITIES } from './data/cities.js';
import { haversineDistance, calculateScore } from './utils/haversine.js';

import BackgroundGlobe from './components/BackgroundGlobe.jsx';
import IntroScreen from './components/IntroScreen.jsx';
import GameMap from './components/GameMap.jsx';
import HUD from './components/HUD.jsx';
import ResultPanel from './components/ResultPanel.jsx';
import ResultsScreen from './components/ResultsScreen.jsx';

const ROUNDS_PER_GAME = 20;
const MAX_PTS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pick `n` random cities, no duplicates. */
function pickCities(n) {
  const shuffled = [...ALL_CITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * App — top-level state machine.
 *
 * Screens:  'intro' → 'game' → 'results'
 * A single <BackgroundGlobe> is mounted across all screens so the launch
 * zoom transition is seamless.
 */
export default function App() {
  const [screen, setScreen] = useState('intro');
  const [launching, setLaunching] = useState(false);  // intro → game transition
  const [fadeBlack, setFadeBlack] = useState(false);  // full-screen black fade

  const globeRef = useRef(null);

  // ── Game state ──────────────────────────────────────────────────────────
  const [cities, setCities] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [totalScore, setTotalScore] = useState(0);

  // ── Round state ─────────────────────────────────────────────────────────
  const [guessLocked, setGuessLocked] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasGuessedOnce, setHasGuessedOnce] = useState(false);
  const [guessCoords, setGuessCoords] = useState(null);

  // ─── Start a new game (resets all round state) ──────────────────────────
  const startGame = useCallback(() => {
    setCities(pickCities(ROUNDS_PER_GAME));
    setRoundIndex(0);
    setScores([]);
    setTotalScore(0);
    setGuessLocked(false);
    setPanelOpen(false);
    setHasGuessedOnce(false);
    setGuessCoords(null);
    setScreen('game');
  }, []);

  // ─── Launch transition: fade UI → zoom globe → fade black → game ────────
  const handleInitiate = useCallback(async () => {
    if (launching) return;
    setLaunching(true);                       // 1. intro UI fades out (0.5s)
    await sleep(500);
    await (globeRef.current?.launch() ?? Promise.resolve()); // 2-3. zoom + stop (1.4s)
    setFadeBlack(true);                       // 4. screen fades to black (0.5s)
    await sleep(500);
    startGame();                              // 5. mount game beneath the black
    await sleep(80);
    setFadeBlack(false);                      //    fade lifts → game revealed
    setLaunching(false);
  }, [launching, startGame]);

  // ─── Handle a guess from the map ────────────────────────────────────────
  const handleGuess = useCallback((lat, lng) => {
    if (guessLocked) return;

    const city = cities[roundIndex];
    const distance = haversineDistance(lat, lng, city.lat, city.lng);
    const score = calculateScore(distance);
    const countryName = city.country;

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

    // Slight delay so the line/markers settle before the panel slides in
    setTimeout(() => setPanelOpen(true), 800);
  }, [guessLocked, cities, roundIndex]);

  // ─── Advance to next round ─────────────────────────────────────────────
  const handleNext = useCallback(() => {
    setPanelOpen(false);
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

  // ─── Dev-mode test helpers ─────────────────────────────────────────────
  if (import.meta.env.DEV && screen === 'game' && cities.length) {
    window.__testGuess = (lat = 0, lng = 0) => handleGuess(lat, lng);
    window.__testSkipToResults = () => {
      const remaining = cities.slice(scores.length);
      const fakeScores = remaining.map((city) => ({
        city: { ...city, countryName: city.country },
        score: Math.floor(Math.random() * 100),
        distance: Math.floor(Math.random() * 9000),
        guessLat: city.lat + 5,
        guessLng: city.lng + 5,
      }));
      setScores((prev) => [...prev, ...fakeScores]);
      setTotalScore((prev) => prev + fakeScores.reduce((s, r) => s + r.score, 0));
      setScreen('results');
    };
  }

  // ─── Computed helpers ──────────────────────────────────────────────────
  const currentCity = cities[roundIndex] || null;
  const currentResult = scores[scores.length - 1] || null;
  const isFinalRound = roundIndex === ROUNDS_PER_GAME - 1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#00000a' }}>

      {/* Persistent satellite globe — behind every screen (z-index: 0) */}
      <BackgroundGlobe
        ref={globeRef}
        interactive={screen === 'intro' && !launching}
        active={screen === 'intro'}
      />

      {/* ── Intro ───────────────────────────────────────────────────────── */}
      {screen === 'intro' && (
        <IntroScreen
          onStart={handleInitiate}
          fading={launching}
          poolCount={ALL_CITIES.length}
          rounds={ROUNDS_PER_GAME}
          maxPts={MAX_PTS}
        />
      )}

      {/* ── Game ────────────────────────────────────────────────────────── */}
      {screen === 'game' && currentCity && (
        <>
          <GameMap
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

      {/* Black fade overlay used during the launch transition */}
      <div className={`fade-overlay${fadeBlack ? ' active' : ''}`} />
    </div>
  );
}
