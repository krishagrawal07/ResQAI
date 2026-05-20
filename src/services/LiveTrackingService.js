import BackendService from './BackendService';
import LocationService from './LocationService';

class LiveTrackingService {
  intervalId = null;

  incidentId = null;

  pushInFlight = false;

  async pushCurrentLocation() {
    if (!this.incidentId || this.pushInFlight) {
      return null;
    }

    this.pushInFlight = true;

    try {
      const currentLocation = await LocationService.getCurrentLocation({
        skipReverseGeocode: true,
      });
      return BackendService.updateIncidentLocation(
        this.incidentId,
        currentLocation,
      );
    } finally {
      this.pushInFlight = false;
    }
  }

  async start({
    incidentId,
    intervalMs = 4000,
    onLocationPushed,
    onTrackingError,
  }) {
    await this.stop();
    this.incidentId = incidentId;

    try {
      const firstUpdate = await this.pushCurrentLocation();
      onLocationPushed?.(firstUpdate?.location || null);
    } catch (error) {
      onTrackingError?.(error);
    }

    this.intervalId = setInterval(async () => {
      try {
        const updatedIncident = await this.pushCurrentLocation();
        if (!updatedIncident) {
          return;
        }

        if (updatedIncident?.status === 'resolved') {
          await this.stop();
          return;
        }
        onLocationPushed?.(updatedIncident?.location || null);
      } catch (error) {
        onTrackingError?.(error);
      }
    }, intervalMs);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.incidentId = null;
    this.pushInFlight = false;
  }
}

const liveTrackingService = new LiveTrackingService();
export default liveTrackingService;
