import { useEffect, useRef, useCallback } from 'react';
import Globe from 'globe.gl';

/**
 * GlobeView — full-screen interactive Globe.gl component.
 *
 * Props:
 *   currentCity   { name, lat, lng, country }  — city to locate this round
 *   guessLocked   bool   — true after player has clicked
 *   guessCoords   { lat, lng } | null
 *   onGuess       (lat, lng) => void  — called on first click
 */
export default function GlobeView({ currentCity, guessLocked, guessCoords, onGuess }) {
  const mountRef  = useRef(null);
  const globeRef  = useRef(null);
  // Stable ref to latest props so event handlers never close over stale values
  const lockedRef = useRef(guessLocked);
  const onGuessRef = useRef(onGuess);

  useEffect(() => { lockedRef.current  = guessLocked;  }, [guessLocked]);
  useEffect(() => { onGuessRef.current = onGuess; },      [onGuess]);

  // ── Mount Globe.gl once ─────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el || globeRef.current) return;

    const g = Globe()(el);
    globeRef.current = g;

    g.width(el.clientWidth || window.innerWidth)
     .height(el.clientHeight || window.innerHeight)
     .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
     .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
     .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
     .atmosphereColor('#1B4FD8')
     .atmosphereAltitude(0.15)
     // Start zoomed out to full globe
     .pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 0);

    // ── Click handler: place guess pin ────────────────────────────────────
    g.onGlobeClick(({ lat, lng }) => {
      if (lockedRef.current) return;
      onGuessRef.current(lat, lng);
    });

    // ── Resize observer ───────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!el || !globeRef.current) return;
      globeRef.current
        .width(el.clientWidth)
        .height(el.clientHeight);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      while (el.firstChild) el.removeChild(el.firstChild);
      globeRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset view when city changes ────────────────────────────────────────
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !currentCity) return;
    g.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 800);
  }, [currentCity?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update markers and arc after guess is locked ────────────────────────
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;

    if (!guessLocked || !guessCoords || !currentCity) {
      // Clear all markers between rounds
      g.pointsData([])
       .arcsData([]);
      return;
    }

    const guessPin = {
      id: 'guess',
      lat: guessCoords.lat,
      lng: guessCoords.lng,
      color: '#F5E642',   // yellow
      radius: 0.5,
      altitude: 0.01,
      label: 'Your guess',
    };

    const actualPin = {
      id: 'actual',
      lat: currentCity.lat,
      lng: currentCity.lng,
      color: '#FF3B3B',   // red
      radius: 0.5,
      altitude: 0.01,
      label: currentCity.name,
    };

    g.pointsData([guessPin, actualPin])
     .pointColor('color')
     .pointRadius('radius')
     .pointAltitude('altitude')
     .pointLabel('label');

    // Draw arc between guess and actual
    const arc = {
      startLat: guessCoords.lat,
      startLng: guessCoords.lng,
      endLat: currentCity.lat,
      endLng: currentCity.lng,
      color: 'rgba(255,255,255,0.7)',
    };

    g.arcsData([arc])
     .arcColor('color')
     .arcAltitudeAutoScale(0.35)
     .arcStroke(0.5)
     .arcDashLength(0.6)
     .arcDashGap(0.2)
     .arcDashAnimateTime(1200);

    // Fit both pins in view
    const midLat  = (guessCoords.lat + currentCity.lat) / 2;
    const midLng  = (guessCoords.lng + currentCity.lng) / 2;
    const latDiff = Math.abs(guessCoords.lat - currentCity.lat);
    const lngDiff = Math.abs(guessCoords.lng - currentCity.lng);
    const spread  = Math.max(latDiff, lngDiff);
    const alt     = Math.min(2.5, Math.max(0.5, spread / 60));

    g.pointOfView({ lat: midLat, lng: midLng, altitude: alt }, 1000);

  }, [guessLocked, guessCoords, currentCity]);

  return (
    <div
      ref={mountRef}
      className="globe-container"
      style={{ cursor: guessLocked ? 'default' : 'crosshair' }}
    />
  );
}
