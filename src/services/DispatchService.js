import {DISPATCH_DELAYS} from '../utils/constants';
import LocationService from './LocationService';
import {
  createDispatchCoordinate,
  createDispatchEntry,
  formatCoordinates,
} from '../utils/helpers';

class DispatchService {
  timers = [];

  async buildSequence(location, userProfile) {
    const [police, pharmacies, fuelStops] = await Promise.all([
      LocationService.getNearbyPlaces(location.lat, location.lng, 'police'),
      LocationService.getNearbyPlaces(location.lat, location.lng, 'pharmacy'),
      LocationService.getNearbyPlaces(
        location.lat,
        location.lng,
        'gas_station',
      ),
    ]);

    return [
      createDispatchEntry({
        id: 'dispatch-police',
        title: police[0]?.name ?? 'Nearest Police Station',
        subtitle:
          police[0]?.address ??
          `Grid lock: ${formatCoordinates(location.lat, location.lng)}`,
        color: '#00E5FF',
        type: 'police',
        eta: 'ETA 2 min',
        coordinate: police[0]
          ? {lat: police[0].lat, lng: police[0].lng}
          : createDispatchCoordinate(location, 0.004, -0.003),
      }),
      createDispatchEntry({
        id: 'dispatch-medical',
        title: pharmacies[0]?.name ?? 'Nearest Medical Store',
        subtitle: pharmacies[0]?.address ?? 'Trauma support pinged',
        color: '#FF3D6B',
        type: 'medical',
        eta: 'ETA 3 min',
        coordinate: pharmacies[0]
          ? {lat: pharmacies[0].lat, lng: pharmacies[0].lng}
          : createDispatchCoordinate(location, -0.003, 0.003),
      }),
      createDispatchEntry({
        id: 'dispatch-landmark',
        title: fuelStops[0]?.name ?? 'Nearest Petrol Pump / Landmark',
        subtitle: fuelStops[0]?.address ?? 'Ground support routed',
        color: '#FFD600',
        type: 'landmark',
        eta: 'ETA 3 min',
        coordinate: fuelStops[0]
          ? {lat: fuelStops[0].lat, lng: fuelStops[0].lng}
          : createDispatchCoordinate(location, 0.002, 0.004),
      }),
      createDispatchEntry({
        id: 'dispatch-contact',
        title: userProfile?.emergencyContact?.name || 'Emergency Contact',
        subtitle:
          userProfile?.emergencyContact?.phone ||
          'Emergency contact line engaged',
        color: '#00FF88',
        type: 'contact',
        eta: 'Voice call active',
        coordinate: createDispatchCoordinate(location, -0.002, -0.004),
      }),
    ];
  }

  stopDispatchSequence() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  async startDispatchSequence({location, userProfile, onDispatch}) {
    this.stopDispatchSequence();
    const sequence = await this.buildSequence(location, userProfile);

    sequence.forEach((entry, index) => {
      const timer = setTimeout(() => {
        onDispatch?.(entry);
      }, DISPATCH_DELAYS[index]);
      this.timers.push(timer);
    });

    return sequence;
  }
}

export default new DispatchService();
