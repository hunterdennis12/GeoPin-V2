import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ESRI_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics';

/* Capped zoom keeps tile render depth light — important for mobile. */
const MIN_ZOOM = 2;
const MAX_ZOOM = 7;

/** Great-circle polyline points, with longitude unwrapped for a clean draw. */
function greatCircle(lat1, lng1, lat2, lng2, segments = 72) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const f1 = toRad(lat1), l1 = toRad(lng1), f2 = toRad(lat2), l2 = toRad(lng2);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((f2 - f1) / 2) ** 2 +
          Math.cos(f1) * Math.cos(f2) * Math.sin((l2 - l1) / 2) ** 2,
      ),
    );
  if (!d) return [[lat1, lng1]];
  const pts = [];
  let prevLng = lng1;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(f1) * Math.cos(l1) + B * Math.cos(f2) * Math.cos(l2);
    const y = A * Math.cos(f1) * Math.sin(l1) + B * Math.cos(f2) * Math.sin(l2);
    const z = A * Math.sin(f1) + B * Math.sin(f2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    let lng = toDeg(Math.atan2(y, x));
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    prevLng = lng;
    pts.push([lat, lng]);
  }
  return pts;
}

function pinIcon(kind, label) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${kind}"><span></span>${
      label ? `<div class="map-pin-label">${label}</div>` : ''
    }</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/**
 * GameMap — flat Leaflet satellite map (Esri World Imagery).
 * Drop-in replacement for the old globe view; identical props.
 *
 *   currentCity  { name, lat, lng, country }
 *   guessLocked  bool
 *   guessCoords  { lat, lng } | null
 *   onGuess      (lat, lng) => void
 */
export default function GameMap({ currentCity, guessLocked, guessCoords, onGuess }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(L.layerGroup());

  const lockedRef = useRef(guessLocked);
  const onGuessRef = useRef(onGuess);
  useEffect(() => { lockedRef.current = guessLocked; }, [guessLocked]);
  useEffect(() => { onGuessRef.current = onGuess; }, [onGuess]);

  // ── Mount the map once ────────────────────────────────────────────────
  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [20, 0],
      zoom: MIN_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      worldCopyJump: true,
      zoomControl: true,
      attributionControl: true,
      maxBounds: [[-85, -200], [85, 200]],
      maxBoundsViscosity: 0.6,
      tap: true,
    });
    mapRef.current = map;

    L.tileLayer(ESRI_URL, {
      attribution: ESRI_ATTR,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      noWrap: false,
    }).addTo(map);

    overlayRef.current.addTo(map);

    map.on('click', (e) => {
      if (lockedRef.current) return;
      onGuessRef.current(e.latlng.lat, e.latlng.lng);
    });

    // Ensure correct sizing once the container is settled (mobile chrome)
    const t = setTimeout(() => map.invalidateSize(), 60);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Reset on each new city ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentCity) return;
    overlayRef.current.clearLayers();
    map.setView([20, 0], MIN_ZOOM, { animate: true });
  }, [currentCity?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw result after a locked guess ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const layer = overlayRef.current;
    if (!map) return;

    layer.clearLayers();
    if (!guessLocked || !guessCoords || !currentCity) return;

    const guess = [guessCoords.lat, guessCoords.lng];
    const actual = [currentCity.lat, currentCity.lng];

    L.polyline(greatCircle(guess[0], guess[1], actual[0], actual[1]), {
      color: '#8fc0ef',
      weight: 1.5,
      opacity: 0.85,
      dashArray: '6 6',
    }).addTo(layer);

    L.marker(guess, { icon: pinIcon('guess', 'Your guess'), interactive: false }).addTo(layer);
    L.marker(actual, { icon: pinIcon('actual', currentCity.name), interactive: false }).addTo(layer);

    // Reserve space for the HUD (top) and the result panel (right on desktop,
    // bottom on mobile) so both pins stay visible once the panel slides in.
    const isMobile = window.innerWidth < 768;
    const paddingTopLeft = [30, 140];
    const paddingBottomRight = isMobile
      ? [30, Math.round(window.innerHeight * 0.64) + 30]
      : [410, 40];
    const bounds = L.latLngBounds([guess, actual]);
    map.fitBounds(bounds, {
      paddingTopLeft,
      paddingBottomRight,
      maxZoom: MAX_ZOOM,
      animate: true,
      duration: 1.1,
      easeLinearity: 0.2,
    });
  }, [guessLocked, guessCoords, currentCity]);

  return (
    <div
      ref={elRef}
      className={`game-map${guessLocked ? '' : ' placing'}`}
    />
  );
}
