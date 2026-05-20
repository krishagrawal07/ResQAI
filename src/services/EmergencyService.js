import AsyncStorage from '@react-native-async-storage/async-storage';
import BackendService from './BackendService';
import CrashDetectionService from './CrashDetectionService';
import FirebaseService from './FirebaseService';
import LiveTrackingService from './LiveTrackingService';
import LocationService from './LocationService';
import SMSService from './SMSService';
import {STORAGE_KEYS} from '../utils/constants';

function hasUsableLocation(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  return (
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
  );
}

class EmergencyService {
  sending = false;

  buildLocalIncident({
    crashSeverity,
    crashSnapshot,
    location,
    mode,
    source,
    smsResults,
    userProfile,
  }) {
    return {
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      location,
      mode,
      notifications: smsResults.map(result => ({
        name:
          result.phone === userProfile?.emergencyContact?.phone
            ? userProfile?.emergencyContact?.name || 'Emergency contact'
            : 'Responder SMS',
        phone: result.phone,
        status: result.status,
        type: 'sms',
      })),
      sensorSnapshot: crashSnapshot,
      severity: crashSeverity,
      source,
      status: 'active',
      trackingUrl:
        location?.lat && location?.lng
          ? `https://maps.google.com/?q=${location.lat},${location.lng}`
          : null,
    };
  }

  async triggerSOS({state, dispatch, source = 'countdown', crashMetaOverride}) {
    if (this.sending) {
      return {status: 'busy'};
    }

    this.sending = true;
    try {
      const {
        crashMeta,
        emergencyPlan,
        location,
        mode,
        preferences,
        sensors,
        userProfile,
      } = state;
      const includeGuardianMode = Boolean(preferences.guardianMode);
      const includeMedicalCard = Boolean(preferences.shareMedicalCard);
      const includeNearbyResponders = Boolean(
        preferences.notifyNearbyResponders,
      );
      const fallbackSeverity = CrashDetectionService.previewSeverity(sensors, {
        speedBeforeKmh: Math.max(
          sensors.speedBeforeKmh || sensors.speed + 30,
          45,
        ),
      });
      const selectedMeta = crashMetaOverride ?? crashMeta;
      const crashSnapshot = selectedMeta?.snapshot ?? fallbackSeverity.snapshot;
      const crashSeverity = selectedMeta?.severity ?? fallbackSeverity.severity;
      const incidentEmergencyPlan = includeMedicalCard
        ? emergencyPlan
        : {
            ...emergencyPlan,
            bloodGroup: 'Hidden by user preference',
            medicalNotes: 'Hidden by user preference',
          };
      const incidentUserProfile = includeMedicalCard
        ? userProfile
        : {
            ...userProfile,
            bloodGroup: 'Hidden',
            medicalNotes: 'Hidden by user preference',
          };

      dispatch({type: 'SOS_TRIGGERED'});

      let resolvedLocation = location;
      let backendIncident = null;
      let nearbyPolice = [];
      let smsResults = [];

      try {
        resolvedLocation = await LocationService.getCurrentLocation();
        dispatch({type: 'SET_LOCATION', payload: resolvedLocation});
        await AsyncStorage.setItem(
          STORAGE_KEYS.LAST_LOCATION,
          JSON.stringify(resolvedLocation),
        );
      } catch (error) {
        resolvedLocation = {
          lat: location.lat,
          lng: location.lng,
          address: location.address || 'Location unavailable',
        };
      }

      if (includeNearbyResponders && hasUsableLocation(resolvedLocation)) {
        nearbyPolice = await LocationService.getNearbyPlaces(
          resolvedLocation.lat,
          resolvedLocation.lng,
          'police',
        );
      }

      if (hasUsableLocation(resolvedLocation)) {
        try {
          backendIncident = await BackendService.createIncident({
            dispatchPreferences: {
              guardianMode: includeGuardianMode,
              notifyNearbyResponders: includeNearbyResponders,
            },
            emergencyPlan: incidentEmergencyPlan,
            location: resolvedLocation,
            metadata: {
              appVersion: 'mobile-expo-sensors',
              detectedAt: selectedMeta?.detectedAt || new Date().toISOString(),
              smsPlanned: true,
              source,
            },
            mode,
            sensorSnapshot: {
              ...crashSnapshot,
              severityLabel: crashSeverity.label,
              severityScore: crashSeverity.score,
              speed: sensors.speed,
            },
            userProfile: incidentUserProfile,
          });
        } catch (backendError) {
          dispatch({
            type: 'SET_RUNTIME_STATUS',
            payload: {startupMode: 'local-sos'},
          });
        }
      } else {
        dispatch({
          type: 'SET_RUNTIME_STATUS',
          payload: {startupMode: 'local-sos'},
        });
      }

      if (backendIncident?.id) {
        dispatch({type: 'SET_ACTIVE_INCIDENT', payload: backendIncident});
        await LiveTrackingService.start({
          incidentId: backendIncident.id,
          intervalMs: 4000,
          onLocationPushed: pushedLocation => {
            if (pushedLocation) {
              dispatch({type: 'SET_LOCATION', payload: pushedLocation});
              dispatch({
                type: 'SET_ACTIVE_INCIDENT',
                payload: {location: pushedLocation},
              });
            }
          },
        });
      }

      smsResults = await SMSService.sendEmergencySMS(
        incidentUserProfile,
        resolvedLocation,
        nearbyPolice,
        {
          includeGuardianMode,
          includeNearbyResponders,
        },
      );

      const incident =
        backendIncident ??
        this.buildLocalIncident({
          crashSeverity,
          crashSnapshot,
          location: resolvedLocation,
          mode,
          source,
          smsResults,
          userProfile: incidentUserProfile,
        });

      dispatch({
        type: 'SET_ACTIVE_INCIDENT',
        payload: {
          ...incident,
          localSmsResults: smsResults,
        },
      });

      await Promise.allSettled([
        FirebaseService.logCrashEvent(
          sensors,
          resolvedLocation,
          FirebaseService.getCurrentUserId(),
        ),
      ]);

      return {
        incident,
        location: resolvedLocation,
        smsResults,
        status: 'sent',
      };
    } finally {
      this.sending = false;
    }
  }
}

export default new EmergencyService();
