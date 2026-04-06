import {MOCK_HOSPITALS} from '../data/mockHospitals.js';
import {haversineDistanceKm} from '../utils/geo.js';

function createGeneratedHospital(lat, lng, index) {
  const offsetLat = (index + 1) * 0.012 * (index % 2 === 0 ? 1 : -1);
  const offsetLng = (index + 1) * 0.01 * (index % 2 === 0 ? -1 : 1);
  return {
    id: `hosp-generated-${index + 1}`,
    name: `Nearby Emergency Hospital ${index + 1}`,
    lat: Number((lat + offsetLat).toFixed(6)),
    lng: Number((lng + offsetLng).toFixed(6)),
    phone: `+1800555000${index + 1}`,
  };
}

class HospitalService {
  findNearest(lat, lng, limit = 3) {
    const baseList = [...MOCK_HOSPITALS];

    if (baseList.length < limit) {
      const generated = Array.from({length: limit - baseList.length}).map(
        (_, index) => createGeneratedHospital(lat, lng, index),
      );
      baseList.push(...generated);
    }

    return baseList
      .map(item => ({
        ...item,
        distanceKm: Number(
          haversineDistanceKm(lat, lng, item.lat, item.lng).toFixed(2),
        ),
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, limit);
  }
}

const hospitalService = new HospitalService();
export default hospitalService;
