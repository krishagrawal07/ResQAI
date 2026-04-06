import BackendService from './BackendService';
import LocationService from './LocationService';

class LiveTrackingService {
  intervalId = null;

  incidentId = null;

  async pushCurrentLocation() {
    if (!this.incidentId) {
      return null;
    }

    const currentLocation = await LocationService.getCurrentLocation();
    return BackendService.updateIncidentLocation(
      this.incidentId,
      currentLocation,
    );
  }

  async start({
    incidentId,
    intervalMs = 6000,
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
  }
}

const liveTrackingService = new LiveTrackingService();
export default liveTrackingService;
