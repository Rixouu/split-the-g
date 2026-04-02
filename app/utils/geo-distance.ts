export interface LatLng {
  lat: number;
  lng: number;
}

/** Earth radius in metres (WGS84 mean). */
const R = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 points in metres. */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Default max distance from Google Place coords to device GPS for “at venue” checks. */
export const DEFAULT_PUB_GEOFENCE_MAX_METERS = 200;
