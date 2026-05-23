/**
 * Map an ISO 3166-1 alpha-2 country code to a human-readable name.
 * Uses the built-in Intl.DisplayNames (supported in modern mobile/desktop
 * browsers), falling back to the raw code if the name can't be resolved.
 */
let regionNames = null;
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {
  regionNames = null;
}

export function countryName(code) {
  if (!code) return '';
  try {
    const name = regionNames?.of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}
