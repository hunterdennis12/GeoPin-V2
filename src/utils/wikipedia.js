/**
 * Wikipedia / Wikimedia Commons API helpers.
 * All fetches are client-side via public APIs — no keys required.
 * CORS is handled via &origin=* on all requests.
 */

/** In-memory cache keyed by city name to avoid re-fetching during a session. */
const cache = new Map();

/**
 * Fetch a descriptive extract for a city.
 * Strategy (reduces blank sections vs. the short REST summary):
 *   1. Resolve the best article title via the search API ("City Country").
 *   2. Pull the first ~10 plain-text sentences via the extracts API.
 *   3. Fall back to the REST summary endpoint if that fails.
 * Returns { title, extract, thumbnail } or null.
 */
export async function fetchWikiSummary(cityName, countryName) {
  const cacheKey = `summary:${cityName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let result = null;

  try {
    const title =
      (await searchTitle(`${cityName} ${countryName}`)) ||
      (await searchTitle(cityName));
    if (title) {
      const extract = await getExtract(title);
      if (extract && extract.length > 80) {
        result = { title, extract, thumbnail: null };
      }
    }
  } catch {
    // fall through to REST summary
  }

  if (!result) {
    result = await restSummary(cityName, countryName);
  }

  cache.set(cacheKey, result);
  return result;
}

/** Resolve the most relevant Wikipedia article title for a query. */
async function searchTitle(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=1&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.query?.search?.[0]?.title || null;
  } catch {
    return null;
  }
}

/** Pull the first ~10 plain-text sentences of an article (follows redirects). */
async function getExtract(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=10&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(
    title,
  )}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    if (page.extract && page.extract.length > 0) return page.extract;
  }
  return null;
}

/** Legacy REST summary fallback (single short intro paragraph). */
async function restSummary(cityName, countryName) {
  const queries = [`${cityName}, ${countryName}`, cityName, `${cityName} city`];
  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q.replace(/ /g, '_'));
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (
        data.extract &&
        data.extract.length > 50 &&
        data.type !== 'disambiguation'
      ) {
        return {
          title: data.title,
          extract: data.extract,
          thumbnail: data.thumbnail?.source || null,
        };
      }
    } catch {
      // try next query
    }
  }
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
 * Parse an extract into 4 named sections. Empty sections return '' so the UI
 * can hide them (rather than showing "unavailable"). The fun fact is the last
 * sentence; the remaining lead text is spread across the three overviews.
 *
 * Returns: { historical, economic, cultural, funFact }
 */
export function parseExtract(extract) {
  const empty = { historical: '', economic: '', cultural: '', funFact: '' };
  if (!extract) return empty;

  const sentences = extract
    .replace(/\n+/g, ' ')
    .split(/(?<=\.)\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const n = sentences.length;
  if (!n) return empty;

  // Use the final sentence as a fun fact only when there's enough to spare.
  const funFact = n >= 5 ? sentences[n - 1] : '';
  const pool = n >= 5 ? sentences.slice(0, n - 1) : sentences.slice();
  const per = Math.ceil(pool.length / 3);

  return {
    historical: pool.slice(0, per).join(' '),
    economic: pool.slice(per, per * 2).join(' '),
    cultural: pool.slice(per * 2).join(' '),
    funFact,
  };
}
