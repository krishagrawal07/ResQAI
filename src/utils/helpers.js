export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function calculateMagnitude(x = 0, y = 0, z = 0) {
  return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
}

export function toPercentage(value, max) {
  if (!max) {
    return 0;
  }

  return clamp((Math.abs(value) / max) * 100, 0, 100);
}

export function formatModeLabel(mode) {
  return mode === 'car' ? 'CAR MODE' : 'BIKER MODE';
}

export function formatCoordinates(lat, lng) {
  if (!lat && !lng) {
    return 'Awaiting GPS lock';
  }

  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function estimateDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function createDispatchCoordinate(
  location,
  offsetLat = 0,
  offsetLng = 0,
) {
  return {
    lat: Number(location?.lat ?? 0) + offsetLat,
    lng: Number(location?.lng ?? 0) + offsetLng,
  };
}

export function createDispatchEntry({
  id,
  title,
  subtitle,
  color,
  type,
  coordinate,
  eta,
}) {
  return {
    id,
    title,
    subtitle,
    color,
    type,
    coordinate,
    eta,
    createdAt: Date.now(),
  };
}

export function normaliseDecibel(rawMeter) {
  return clamp((rawMeter ?? -160) + 160, 0, 120);
}
