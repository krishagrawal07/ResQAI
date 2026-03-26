import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens} from 'react-native-screens';
import AppNavigator from './src/navigation/AppNavigator';
import {AppProvider, useAppContext} from './src/context/AppContext';
import FirebaseService from './src/services/FirebaseService';
import NotificationService from './src/services/NotificationService';
import SensorService from './src/services/SensorService';
import {COLORS, STORAGE_KEYS} from './src/utils/constants';
import {requestAllPermissions} from './src/utils/permissions';

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

function AppBootstrap() {
  const {dispatch} = useAppContext();

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      await requestAllPermissions();
      await FirebaseService.initialize();
      NotificationService.configure();

      const [savedProfile, savedLocation] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION),
      ]);

      if (!isMounted) {
        return;
      }

      if (savedProfile) {
        dispatch({
          type: 'SET_USER_PROFILE',
          payload: JSON.parse(savedProfile),
        });
      }

      if (savedLocation) {
        dispatch({
          type: 'SET_LOCATION',
          payload: JSON.parse(savedLocation),
        });
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      SensorService.stopMonitoring();
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
