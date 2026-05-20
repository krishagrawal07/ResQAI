import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {GOOGLE_MAPS_API_KEY} from '@env';
import {STORAGE_KEYS} from '../utils/constants';
import {estimateDistanceKm} from '../utils/helpers';

export const BACKGROUND_LOCATION_TASK = 'resqai-background-location';

const MAX_SPEED_SAMPLE_AGE_MS = 120000;
const MAX_REASONABLE_SPEED_KMH = 260;

let backgroundLocationCallback = null;
let lastKnownLocationSample = null;

function hasCoordinate(sample) {
  return (
    Number.isFinite(Number(sample?.lat)) && Number.isFinite(Number(sample?.lng))
  );
}

function normaliseLocation(position, source = 'phone-gps') {
  const coords = position?.coords ?? {};
  const timestamp = position?.timestamp ?? Date.now();
  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid GPS coordinates received from location provider.');
  }

  const previousSample =
    hasCoordinate(lastKnownLocationSample) &&
    Number.isFinite(lastKnownLocationSample.timestamp) &&
    timestamp - lastKnownLocationSample.timestamp > 0 &&
    timestamp - lastKnownLocationSample.timestamp <= MAX_SPEED_SAMPLE_AGE_MS
      ? lastKnownLocationSample
      : null;
  const measuredSpeedKmh =
    Number.isFinite(coords.speed) && coords.speed >= 0
      ? coords.speed * 3.6
      : null;
  let computedSpeedKmh = 0;

  if (
    previousSample &&
    Number.isFinite(previousSample.timestamp) &&
    timestamp > previousSample.timestamp
  ) {
    const distanceKm = estimateDistanceKm(
      previousSample.lat,
      previousSample.lng,
      latitude,
      longitude,
    );
    const elapsedHours = (timestamp - previousSample.timestamp) / 3600000;
    computedSpeedKmh = elapsedHours > 0 ? distanceKm / elapsedHours : 0;
  }

  const speed = Math.min(
    Math.max(0, measuredSpeedKmh ?? computedSpeedKmh),
    MAX_REASONABLE_SPEED_KMH,
  );
  const speedBeforeKmh = previousSample?.speed ?? 0;
  const speedDropKmh = Math.max(0, speedBeforeKmh - speed);
  const speedDropPercent =
    speedBeforeKmh > 0 ? (speedDropKmh / speedBeforeKmh) * 100 : 0;
  const nextLocation = {
    lat: latitude,
    lng: longitude,
    accuracy: coords.accuracy,
    altitude: coords.altitude,
    heading: coords.heading,
    speed: Number(speed.toFixed(2)),
    speedAfterKmh: Number(speed.toFixed(2)),
    speedBeforeKmh: Number(speedBeforeKmh.toFixed(2)),
    speedDropKmh: Number(speedDropKmh.toFixed(2)),
    speedDropPercent: Number(speedDropPercent.toFixed(2)),
    speedSampleAt: timestamp,
    source,
    timestamp,
  };

  lastKnownLocationSample = nextLocation;
  return nextLocation;
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({data, error}) => {
    if (error) {
      console.log('Background location task error', error);
      return;
    }

    const locations = data?.locations ?? [];
    const latest = locations[locations.length - 1];
    if (!latest) {
      return;
    }

    let nextLocation;

    try {
      nextLocation = normaliseLocation(latest, 'background-gps');
    } catch (locationError) {
      console.log('Background location sample skipped', locationError);
      return;
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_LOCATION,
        JSON.stringify(nextLocation),
      );
    } catch (storageError) {
      console.log('Background location store error', storageError);
    }

    backgroundLocationCallback?.(nextLocation);
  });
}

class LocationService {
  watchSubscription = null;

  async ensureForegroundPermission() {
    let permission = await Location.getForegroundPermissionsAsync();

    if (!permission.granted) {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    return permission.granted;
  }

  async ensureBackgroundPermission() {
    const hasForeground = await this.ensureForegroundPermission();
    if (!hasForeground) {
      return false;
    }

    let permission = await Location.getBackgroundPermissionsAsync();
    if (!permission.granted) {
      permission = await Location.requestBackgroundPermissionsAsync();
    }

    return permission.granted;
  }

  async startWatching(callback, options = {}) {
    await this.stopWatching();

    const hasPermission = await this.ensureForegroundPermission();
    if (!hasPermission) {
      throw new Error('Location permission was not granted.');
    }

    this.watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: options.distanceMeters ?? 1,
        mayShowUserSettingsDialog: true,
        timeInterval: options.intervalMs ?? 3500,
      },
      position => {
        try {
          const nextLocation = normaliseLocation(position);
          callback?.(nextLocation);
        } catch (locationError) {
          console.log('Foreground location sample skipped', locationError);
        }
      },
    );

    return this.watchSubscription;
  }

  async stopWatching() {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  setBackgroundLocationCallback(callback) {
    backgroundLocationCallback = callback;
  }

  async startBackgroundLocationUpdates(callback) {
    this.setBackgroundLocationCallback(callback);

    const hasPermission = await this.ensureBackgroundPermission();
    if (!hasPermission) {
      return false;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    ).catch(() => false);

    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesDistance: 0,
        deferredUpdatesInterval: 5000,
        distanceInterval: 5,
        foregroundService: {
          notificationBody:
            'ResQ AI is keeping your emergency GPS active while monitoring.',
          notificationColor: '#FF3B30',
          notificationTitle: 'ResQ AI monitoring',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        timeInterval: 5000,
      });
    }

    return true;
  }

  async stopBackgroundLocationUpdates() {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    ).catch(() => false);

    if (alreadyStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    this.setBackgroundLocationCallback(null);
  }

  async reverseGeocode(lat, lng) {
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (place) {
        return [
          place.name,
          place.street,
          place.city,
          place.region,
          place.postalCode,
          place.country,
        ]
          .filter(Boolean)
          .join(', ');
      }
    } catch (error) {
      console.log('Device reverse geocode error', error);
    }

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
      console.log('Reverse geocode fallback error', error);
      return 'Address unavailable';
    }
  }

  async getCurrentLocation(options = {}) {
    const hasPermission = await this.ensureForegroundPermission();
    if (!hasPermission) {
      throw new Error('Location permission was not granted.');
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      mayShowUserSettingsDialog: true,
    });
    const nextLocation = normaliseLocation(position);

    if (!options.skipReverseGeocode) {
      nextLocation.address = await this.reverseGeocode(
        nextLocation.lat,
        nextLocation.lng,
      );
    }

    return nextLocation;
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
