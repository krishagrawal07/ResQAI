import Geolocation from 'react-native-geolocation-service';
import {GOOGLE_MAPS_API_KEY} from '@env';
import {estimateDistanceKm} from '../utils/helpers';

class LocationService {
  watchId = null;

  startWatching(callback) {
    this.stopWatching();

    this.watchId = Geolocation.watchPosition(
      position =>
        callback({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: Math.max(0, (position.coords.speed ?? 0) * 3.6),
        }),
      error => {
        console.log('Location watch error', error);
      },
      {
        enableHighAccuracy: true,
        interval: 1000,
        fastestInterval: 1000,
        distanceFilter: 5,
        showsBackgroundLocationIndicator: true,
      },
    );

    return this.watchId;
  }

  stopWatching() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'ResQAI/1.0',
          },
        },
      );
      const json = await response.json();
      return json?.display_name ?? 'Address unavailable';
    } catch (error) {
      console.log('Reverse geocode error', error);
      return 'Address unavailable';
    }
  }

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        async position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await this.reverseGeocode(lat, lng);
          resolve({lat, lng, address});
        },
        error => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
          forceRequestLocation: true,
        },
      );
    });
  }

  async getNearbyPlaces(lat, lng, type = 'police') {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_key_here') {
      return this.getFallbackPlaces(lat, lng, type);
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const json = await response.json();
      const places = (json?.results ?? []).map((place, index) => ({
        id: `${type}-${place.place_id ?? index}`,
        name: place.name,
        address:
          place.vicinity ?? place.formatted_address ?? 'Address unavailable',
        distance: estimateDistanceKm(
          lat,
          lng,
          place.geometry?.location?.lat ?? lat,
          place.geometry?.location?.lng ?? lng,
        ),
        lat: place.geometry?.location?.lat ?? lat,
        lng: place.geometry?.location?.lng ?? lng,
        type,
      }));

      return places.sort((left, right) => left.distance - right.distance);
    } catch (error) {
      console.log('Nearby place lookup error', error);
      return this.getFallbackPlaces(lat, lng, type);
    }
  }

  getFallbackPlaces(lat, lng, type) {
    const labels = {
      police: ['Central Police Station', 'Rapid Patrol Unit'],
      pharmacy: ['24x7 Medical Store', 'Community Clinic'],
      gas_station: ['Fuel Station Landmark', 'Highway Service Point'],
    };

    return (labels[type] ?? ['Nearby Aid Point']).map((label, index) => ({
      id: `${type}-fallback-${index}`,
      name: label,
      address: 'Approximate nearby response point',
      distance: Number((0.5 + index * 0.6).toFixed(2)),
      lat: lat + 0.004 * (index + 1),
      lng: lng - 0.003 * (index + 1),
      type,
    }));
  }
}

export default new LocationService();
