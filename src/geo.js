// geo.js — location helpers for the map view.
//
// The create-post form shows a country dropdown and an optional "specific
// location" field. When someone picks a country we store its rough centroid
// (countryToLatLng); when they type an exact spot we parse the coordinates
// (parseLatLng) and use those instead. A small hand-picked country table on
// purpose — no geocoding API, so the app stays fully offline. Country
// coordinates are a rough centroid; good enough for a world map.
//
// Load this BEFORE any code that calls countryToLatLng() (db.js does not depend
// on it — the form does the lookup and passes lat/lng into createPost()).

const COUNTRY_COORDS = {
  // Demo / test countries
  'Vietnam': [14.058, 108.277],
  'Mexico': [23.635, -102.553],
  'France': [46.228, 2.214],

  // Ethnicities already used in the seed data
  'China': [35.862, 104.195],
  'Greece': [39.074, 21.824],
  'South Korea': [35.908, 127.767],
  'India': [20.594, 78.963],

  // A broader spread so the dropdown isn't tiny
  'Italy': [41.872, 12.567],
  'Spain': [40.464, -3.749],
  'Portugal': [39.400, -8.224],
  'Germany': [51.166, 10.452],
  'Poland': [51.919, 19.145],
  'Ireland': [53.413, -8.244],
  'United Kingdom': [55.378, -3.436],
  'Turkey': [38.964, 35.243],
  'Lebanon': [33.855, 35.862],
  'Egypt': [26.821, 30.802],
  'Morocco': [31.792, -7.093],
  'Nigeria': [9.082, 8.675],
  'Ethiopia': [9.145, 40.490],
  'Kenya': [-0.024, 37.906],
  'South Africa': [-30.559, 22.937],
  'Japan': [36.205, 138.253],
  'Thailand': [15.870, 100.993],
  'Philippines': [12.880, 121.774],
  'Indonesia': [-0.789, 113.921],
  'Malaysia': [4.210, 101.976],
  'Pakistan': [30.375, 69.345],
  'Bangladesh': [23.685, 90.356],
  'Iran': [32.428, 53.688],
  'Brazil': [-14.235, -51.925],
  'Peru': [-9.190, -75.015],
  'Argentina': [-38.416, -63.617],
  'Colombia': [4.571, -74.297],
  'United States': [39.828, -98.579],
  'Canada': [56.130, -106.347],
  'Australia': [-25.274, 133.775],
  'New Zealand': [-40.900, 174.886]
};

// Returns { lat, lng } for a country name, or null when it isn't in the table.
// Case-insensitive and whitespace-tolerant.
function countryToLatLng(country) {
  if (!country) return null;
  const needle = String(country).trim().toLowerCase();
  const key = Object.keys(COUNTRY_COORDS).find(k => k.trim().toLowerCase() === needle);
  if (!key) return null;
  const [lat, lng] = COUNTRY_COORDS[key];
  return { lat, lng };
}

// Sorted list of country names, for populating a <select> in the form.
function supportedCountries() {
  return [...new Set(Object.keys(COUNTRY_COORDS).map(k => k.trim()))].sort();
}

// Parse a free-text "latitude, longitude" string (e.g. copied straight out of
// Google Maps) into { lat, lng }. Accepts comma- or space-separated numbers and
// tolerates surrounding brackets/whitespace. Returns null when it can't find two
// numbers in valid range — the form treats that as "no specific location".
function parseLatLng(text) {
  if (!text) return null;
  const nums = String(text).match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const lat = parseFloat(nums[0]);
  const lng = parseFloat(nums[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
