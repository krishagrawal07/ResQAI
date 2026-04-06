import {DISPATCH_DELAYS} from '../utils/constants';
import LocationService from './LocationService';
import {
  createDispatchCoordinate,
  createDispatchEntry,
  formatCoordinates,
} from '../utils/helpers';

class DispatchService {
  timers = [];

  async buildSequence(location, userProfile, preferences = {}) {
    const includeNearbyResponders =
      preferences.notifyNearbyResponders !== false;
    const includeGuardianMode = preferences.guardianMode !== false;
    const sequence = [];

    if (includeNearbyResponders) {
      const [police, pharmacies, fuelStops] = await Promise.all([
        LocationService.getNearbyPlaces(location.lat, location.lng, 'police'),
        LocationService.getNearbyPlaces(location.lat, location.lng, 'pharmacy'),
        LocationService.getNearbyPlaces(
          location.lat,
          location.lng,
          'gas_station',
        ),
      ]);

      sequence.push(
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
      );
    }

    if (includeGuardianMode) {
      sequence.push(
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
      );
    }

    if (sequence.length === 0) {
      sequence.push(
        createDispatchEntry({
          id: 'dispatch-desk',
          title: 'Emergency Desk Standby',
          subtitle: 'Manual escalation path remains active',
          color: '#28E7FF',
          type: 'desk',
          eta: 'Monitoring',
          coordinate: createDispatchCoordinate(location, 0.0016, -0.0014),
        }),
      );
    }

    return sequence;
  }

  stopDispatchSequence() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  async startDispatchSequence({
    location,
    userProfile,
    preferences,
    onDispatch,
  }) {
    this.stopDispatchSequence();
    const sequence = await this.buildSequence(
      location,
      userProfile,
      preferences,
    );

    sequence.forEach((entry, index) => {
      const baseDelay =
        DISPATCH_DELAYS[index] ??
        DISPATCH_DELAYS[DISPATCH_DELAYS.length - 1] +
          (index - (DISPATCH_DELAYS.length - 1)) * 1200;
      const timer = setTimeout(() => {
        onDispatch?.(entry);
      }, baseDelay);
      this.timers.push(timer);
    });

    return sequence;
  }
}

export default new DispatchService();
