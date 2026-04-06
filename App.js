import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens} from 'react-native-screens';
import AppNavigator from './src/navigation/AppNavigator';
import {AppProvider, useAppContext} from './src/context/AppContext';
import FirebaseService from './src/services/FirebaseService';
import LiveTrackingService from './src/services/LiveTrackingService';
import NotificationService from './src/services/NotificationService';
import SensorService from './src/services/SensorService';
import {COLORS, STORAGE_KEYS} from './src/utils/constants';

enableScreens(true);

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.BG,
    card: COLORS.BG2,
    border: 'rgba(0,229,255,0.08)',
    primary: COLORS.CYAN,
    text: COLORS.TEXT,
    notification: COLORS.PINK,
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
  const {dispatch} = useAppContext();

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
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION),
        AsyncStorage.getItem(STORAGE_KEYS.APP_PREFERENCES),
        AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_PLAN),
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
    };

    bootstrap();

    return () => {
      isMounted = false;
      SensorService.stopMonitoring();
      LiveTrackingService.stop();
      NotificationService.release();
    };
  }, [dispatch]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />
      <AppNavigator />
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
