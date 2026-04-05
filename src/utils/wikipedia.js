/**
 * Wikipedia / Wikimedia Commons API helpers.
 * All fetches are client-side via public APIs — no keys required.
 * CORS is handled via &origin=* on all requests.
 */

/** In-memory cache keyed by city name to avoid re-fetching during a session. */
const cache = new Map();

/**
 * Fetch the Wikipedia summary extract for a city.
 * Returns { title, extract, thumbnail } or null on failure.
 */
export async function fetchWikiSummary(cityName, countryName) {
  const cacheKey = `summary:${cityName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  // Try city name first, then "City, Country" if that fails
  const queries = [cityName, `${cityName}, ${countryName}`, `${cityName} city`];

  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q.replace(/ /g, '_'));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.extract && data.extract.length > 50) {
        const result = {
          title: data.title,
          extract: data.extract,
          thumbnail: data.thumbnail?.source || null,
        };
        cache.set(cacheKey, result);
        return result;
      }
    } catch (_) {
      // continue to next query
    }
  }

  cache.set(cacheKey, null);
  return null;
}

/**
 * Fetch up to 3 images of a city from Wikimedia Commons.
 * Returns an array of image URLs (may be empty if all fail).
 */
export async function fetchCityImages(cityName) {
  const cacheKey = `images:${cityName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const images = [];

  try {
    // First try: Wikipedia page images prop
    const encoded = encodeURIComponent(cityName);
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&piprop=thumbnail&pithumbsize=600&format=json&origin=*`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        for (const page of Object.values(pages)) {
          if (page.thumbnail?.source) {
            images.push(page.thumbnail.source);
          }
        }
      }
    }
  } catch (_) {}

  // Second try: Wikimedia Commons file search
  if (images.length < 3) {
    try {
      const encoded = encodeURIComponent(`${cityName} city`);
      const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srnamespace=6&srlimit=6&format=json&origin=*`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results = data?.query?.search || [];
        for (const item of results) {
          if (images.length >= 3) break;
          // Convert file title to thumbnail URL
          const title = item.title.replace('File:', '');
          const encodedTitle = encodeURIComponent(title);
          const thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedTitle}?width=600`;
          images.push(thumbUrl);
        }
      }
    } catch (_) {}
  }

  const result = images.slice(0, 3);
  cache.set(cacheKey, result);
  return result;
}

/**
 * Parse a long Wikipedia extract into 4 named sections.
 * We use sentence-boundary splitting and heuristics since the REST summary
 * API returns a single plain-text extract (not structured).
 *
 * Returns: { historical, economic, cultural, funFact }
 * Each field is a string of up to 3 sentences.
 */
export function parseExtract(extract) {
  if (!extract) {
    return {
      historical: 'Historical data unavailable.',
      economic: 'Economic data unavailable.',
      cultural: 'Cultural data unavailable.',
      funFact: 'Data unavailable.',
    };
  }

  // Split into sentences on ". " or "." followed by capital letter
  const sentences = extract
    .replace(/\n/g, ' ')
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const total = sentences.length;

  // Distribute sentences across sections
  const take = (start, count) =>
    sentences.slice(start, start + count).join(' ') || 'Data unavailable.';

  if (total <= 4) {
    return {
      historical: take(0, 1),
      economic: take(1, 1),
      cultural: take(2, 1),
      funFact: take(3, 1) || take(0, 1),
    };
  }

  const quarter = Math.floor(total / 4);

  return {
    historical: take(0, Math.min(3, quarter)),
    economic: take(quarter, Math.min(3, quarter)),
    cultural: take(quarter * 2, Math.min(3, quarter)),
    funFact: take(total - 1, 1),
  };
}
