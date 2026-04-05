/**
 * Haversine formula — calculates the great-circle distance between two points
 * on a sphere (Earth) given their latitude/longitude in decimal degrees.
 * Returns distance in kilometers.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Score calculation: 100 points for 0 km away, 0 points for 10,000+ km away.
 * Score = max(0, round(100 × (1 − distance_km / 10000)))
 */
export function calculateScore(distanceKm) {
  return Math.max(0, Math.round(100 * (1 - distanceKm / 10000)));
}

/**
 * Returns a color string based on score value (0–100).
 * yellow = high (80–100), white = mid (50–79), dim blue = low (0–49)
 */
export function scoreColor(score) {
  if (score >= 80) return '#F5E642';
  if (score >= 50) return '#FFFFFF';
  return '#6688AA';
}
