import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createNavigationContainerRef,
  DarkTheme,
  NavigationContainer,
} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens} from 'react-native-screens';
import AppNavigator from './src/navigation/AppNavigator';
import {AppProvider, useAppContext} from './src/context/AppContext';
import CrashAlertModal from './src/components/CrashAlertModal';
import CrashDetectionService from './src/services/CrashDetectionService';
import EmergencyService from './src/services/EmergencyService';
import FirebaseService from './src/services/FirebaseService';
import LiveTrackingService from './src/services/LiveTrackingService';
import NotificationService from './src/services/NotificationService';
import SensorService from './src/services/SensorService';
import {COLORS, STORAGE_KEYS} from './src/utils/constants';

enableScreens(true);

const navigationRef = createNavigationContainerRef();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.BG,
    card: COLORS.BG2,
    border: COLORS.BORDER,
    primary: COLORS.ACCENT,
    text: COLORS.TEXT,
    notification: COLORS.PRIMARY,
  },
};

function parseStoredJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function AppBootstrap() {
  const {state, dispatch} = useAppContext();
  const latestStateRef = useRef(state);
  const autoEmergencyRef = useRef(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const navigateToDispatch = useCallback(() => {
    if (!navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate('MainTabs', {screen: 'Dispatch'});
  }, []);

  const triggerImmediateEmergency = useCallback(
    async ({crashMetaOverride, source}) => {
      const latestState = latestStateRef.current;

      if (autoEmergencyRef.current || latestState.sosTriggered) {
        return;
      }

      autoEmergencyRef.current = true;

      try {
        await NotificationService.hapticAlert();
        await NotificationService.playSoftAlertTone({volume: 0.32});
        await EmergencyService.triggerSOS({
          crashMetaOverride,
          dispatch,
          source,
          state: latestState,
        });
        navigateToDispatch();
      } catch (error) {
        console.log('Background emergency dispatch failed', error);
        dispatch({
          type: 'SET_RUNTIME_STATUS',
          payload: {
            lastSosError:
              error?.message || 'Background emergency could not be sent',
            startupMode: 'local-sos',
          },
        });
      } finally {
        autoEmergencyRef.current = false;
      }
    },
    [dispatch, navigateToDispatch],
  );

  const handleCrashDetected = useCallback(
    detectionPayload => {
      if (!detectionPayload) {
        return;
      }

      if (detectionPayload.action === 'full-emergency') {
        triggerImmediateEmergency({
          crashMetaOverride: detectionPayload,
          source: 'full-emergency',
        });
        return;
      }

      if (detectionPayload.action === 'sos-countdown') {
        dispatch({type: 'CRASH_DETECTED', payload: detectionPayload});
      }
    },
    [dispatch, triggerImmediateEmergency],
  );

  const handleShakeDetected = useCallback(
    payload => {
      const latestState = latestStateRef.current;

      if (!latestState.preferences.shakeToSOS) {
        return;
      }

      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {lastShakeAt: payload.detectedAt},
      });

      const severityPreview = CrashDetectionService.previewSeverity(
        latestState.sensors,
        {
          speedBeforeKmh: Math.max(
            latestState.sensors.speedBeforeKmh ||
              latestState.sensors.speed + 30,
            45,
          ),
        },
      );

      triggerImmediateEmergency({
        crashMetaOverride: {
          detectedAt: payload.detectedAt || new Date().toISOString(),
          severity: {
            ...severityPreview.severity,
            label: 'Shake SOS',
          },
          snapshot: severityPreview.snapshot,
        },
        source: 'shake-sos',
      });
    },
    [dispatch, triggerImmediateEmergency],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      let firebaseReady = false;

      try {
        const firebaseApp = await FirebaseService.initialize();
        firebaseReady = Boolean(firebaseApp);
      } catch (error) {
        firebaseReady = false;
      }

      NotificationService.configure();

      const [
        savedProfile,
        savedLocation,
        savedPreferences,
        savedEmergencyPlan,
        savedMonitoringSession,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION),
        AsyncStorage.getItem(STORAGE_KEYS.APP_PREFERENCES),
        AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_PLAN),
        AsyncStorage.getItem(STORAGE_KEYS.MONITORING_SESSION),
      ]);

      if (!isMounted) {
        return;
      }

      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {firebaseReady},
      });

      const parsedProfile = parseStoredJson(savedProfile);
      const parsedLocation = parseStoredJson(savedLocation);
      const parsedPreferences = parseStoredJson(savedPreferences);
      const parsedEmergencyPlan = parseStoredJson(savedEmergencyPlan);
      const parsedMonitoringSession = parseStoredJson(savedMonitoringSession);

      if (parsedProfile) {
        dispatch({
          type: 'SET_USER_PROFILE',
          payload: parsedProfile,
        });
      }

      if (parsedLocation) {
        dispatch({
          type: 'SET_LOCATION',
          payload: parsedLocation,
        });
      }

      if (parsedPreferences) {
        dispatch({
          type: 'SET_PREFERENCES',
          payload: parsedPreferences,
        });
      }

      if (parsedEmergencyPlan) {
        dispatch({
          type: 'SET_EMERGENCY_PLAN',
          payload: parsedEmergencyPlan,
        });
      }

      if (parsedMonitoringSession?.mode) {
        dispatch({
          type: 'SET_MODE',
          payload: parsedMonitoringSession.mode,
        });
      }

      if (parsedMonitoringSession?.active) {
        dispatch({
          type: 'SET_MONITORING',
          payload: true,
        });
      }

      setBootstrapped(true);
    };

    bootstrap();

    return () => {
      isMounted = false;
      SensorService.stopMonitoring();
      LiveTrackingService.stop();
      NotificationService.release();
    };
  }, [dispatch]);

  useEffect(() => {
    CrashDetectionService.setMode(state.mode);
    CrashDetectionService.setSensitivity(
      state.preferences.detectionSensitivity,
    );
  }, [state.mode, state.preferences.detectionSensitivity]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    if (!state.isMonitoring) {
      SensorService.stopMonitoring().catch(error => {
        console.log('Global stop monitoring failed', error);
      });
      return;
    }

    SensorService.startMonitoring({
      mode: state.mode,
      onCrash: handleCrashDetected,
      onLocationUpdate: nextLocation => {
        dispatch({type: 'SET_LOCATION', payload: nextLocation});
      },
      onSensorUpdate: nextSensors => {
        dispatch({type: 'UPDATE_SENSORS', payload: nextSensors});
      },
      onShake: handleShakeDetected,
      onStatusChange: nextStatus => {
        dispatch({type: 'SET_RUNTIME_STATUS', payload: nextStatus});
      },
    }).catch(error => {
      console.log('Global start monitoring failed', error);
      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {
          lastMonitoringError:
            error?.message || 'Live monitoring could not be started',
          startupMode: 'permissions-needed',
        },
      });
      dispatch({type: 'SET_MONITORING', payload: false});
    });
  }, [
    dispatch,
    handleCrashDetected,
    handleShakeDetected,
    bootstrapped,
    state.isMonitoring,
    state.mode,
  ]);

  useEffect(() => {
    dispatch({
      type: 'SET_RUNTIME_STATUS',
      payload: {appState: AppState.currentState},
    });

    const subscription = AppState.addEventListener('change', nextAppState => {
      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {appState: nextAppState},
      });
      SensorService.handleAppStateChange(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [dispatch]);

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />
      <AppNavigator />
      <CrashAlertModal />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppBootstrap />
      </AppProvider>
    </SafeAreaProvider>
  );
}
