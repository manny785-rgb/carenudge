// Location helpers. Nothing here stores or sends coordinates: callers keep them in memory only.

export interface Point {
  lat: number;
  lng: number;
}

/** Great-circle distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`);

/** Coarse centres of Singapore areas, for people who don't share their location. */
export const AREAS: Record<string, Point> = {
  "Ang Mo Kio": { lat: 1.3691, lng: 103.8454 },
  Bedok: { lat: 1.3236, lng: 103.9273 },
  "Bukit Merah": { lat: 1.2819, lng: 103.8239 },
  "Bukit Timah": { lat: 1.3294, lng: 103.8021 },
  Central: { lat: 1.284, lng: 103.851 },
  Changi: { lat: 1.3644, lng: 103.9915 },
  "Choa Chu Kang": { lat: 1.3840, lng: 103.7470 },
  Clementi: { lat: 1.3162, lng: 103.7649 },
  Geylang: { lat: 1.3201, lng: 103.8918 },
  Hougang: { lat: 1.3612, lng: 103.8863 },
  "Jurong East": { lat: 1.3329, lng: 103.7436 },
  "Marine Parade": { lat: 1.3020, lng: 103.9070 },
  Novena: { lat: 1.3203, lng: 103.8438 },
  Orchard: { lat: 1.3048, lng: 103.8318 },
  Queenstown: { lat: 1.2942, lng: 103.806 },
  Sengkang: { lat: 1.3868, lng: 103.8914 },
  Tampines: { lat: 1.3496, lng: 103.9568 },
  "Toa Payoh": { lat: 1.3343, lng: 103.8563 },
  Woodlands: { lat: 1.4382, lng: 103.789 },
  Yishun: { lat: 1.4304, lng: 103.8354 },
};

// First two digits of a Singapore postal code (the "sector") to a coarse area.
const SECTORS: [number, number, string][] = [
  [1, 8, "Central"], [9, 10, "Bukit Merah"], [11, 13, "Clementi"], [14, 16, "Queenstown"], [17, 21, "Central"],
  [22, 23, "Orchard"], [24, 27, "Bukit Timah"], [28, 30, "Novena"], [31, 37, "Toa Payoh"], [38, 41, "Geylang"],
  [42, 45, "Marine Parade"], [46, 48, "Bedok"], [49, 50, "Changi"], [51, 52, "Tampines"], [53, 55, "Hougang"],
  [56, 57, "Ang Mo Kio"], [58, 59, "Bukit Timah"], [60, 64, "Jurong East"], [65, 71, "Choa Chu Kang"],
  [72, 73, "Woodlands"], [75, 76, "Yishun"], [77, 78, "Ang Mo Kio"], [79, 80, "Sengkang"],
];

/** "680123" -> "Choa Chu Kang". Only the area is used, never the exact address. */
export function areaFromPostal(code: string): string | null {
  if (!/^\d{6}$/.test(code.trim())) return null;
  const sector = Number(code.trim().slice(0, 2));
  return SECTORS.find(([lo, hi]) => sector >= lo && sector <= hi)?.[2] ?? null;
}

/** Ask the browser for a position. Only call this from a button tap. */
export function locate(): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export const LOCATE_MESSAGES: Record<string, string> = {
  denied: "Location permission was declined. You can enter your postal code or choose an area instead.",
  timeout: "Finding your location took too long. Try again, or enter your postal code or choose an area.",
  unavailable: "Your location isn't available on this device. Enter your postal code or choose an area instead.",
};
