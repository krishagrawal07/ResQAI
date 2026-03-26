import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';
import {useAppContext} from '../context/AppContext';
import DispatchService from '../services/DispatchService';
import FirebaseService from '../services/FirebaseService';
import LocationService from '../services/LocationService';
import NotificationService from '../services/NotificationService';
import SMSService from '../services/SMSService';
import {COLORS, STORAGE_KEYS} from '../utils/constants';

export default function CrashAlertModal() {
  const navigation = useNavigation();
  const {
    state: {crashDetected, sensors, userProfile, location},
    dispatch,
  } = useAppContext();
  const [countdown, setCountdown] = useState(10);
  const shake = useRef(new Animated.Value(0)).current;
  const warningBlink = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(280)).current;
  const countdownRef = useRef(null);
  const isHandlingRef = useRef(false);
  const rippleValues = useMemo(
    () => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    [],
  );

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    clearTimers();
    NotificationService.stopAlarm();
    dispatch({type: 'RESET_CRASH'});
  }, [clearTimers, dispatch]);

  const handleSOS = useCallback(async () => {
    if (isHandlingRef.current) {
      return;
    }

    isHandlingRef.current = true;
    clearTimers();
    NotificationService.stopAlarm();
    dispatch({type: 'SOS_TRIGGERED'});

    let resolvedLocation = location;

    try {
      resolvedLocation = await LocationService.getCurrentLocation();
      dispatch({type: 'SET_LOCATION', payload: resolvedLocation});
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_LOCATION,
        JSON.stringify(resolvedLocation),
      );
    } catch (error) {
      console.log('Current location fallback', error);
      resolvedLocation = {
        lat: location.lat,
        lng: location.lng,
        address: location.address || 'Location unavailable',
      };
    }

    const nearbyPolice = await LocationService.getNearbyPlaces(
      resolvedLocation.lat,
      resolvedLocation.lng,
      'police',
    );

    await Promise.allSettled([
      SMSService.sendEmergencySMS(userProfile, resolvedLocation, nearbyPolice),
      FirebaseService.logCrashEvent(
        sensors,
        resolvedLocation,
        FirebaseService.getCurrentUserId(),
      ),
      DispatchService.startDispatchSequence({
        location: resolvedLocation,
        userProfile,
        onDispatch: entry => {
          dispatch({type: 'ADD_DISPATCH_LOG', payload: entry});
        },
      }),
    ]);

    navigation.navigate('Dispatch');
  }, [clearTimers, dispatch, location, navigation, sensors, userProfile]);

  useEffect(() => {
    if (!crashDetected) {
      clearTimers();
      return undefined;
    }

    isHandlingRef.current = false;
    setCountdown(10);
    progressWidth.setValue(280);
    NotificationService.triggerCrashAlarm();

    Animated.sequence([
      Animated.timing(shake, {
        toValue: -12,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 12,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -8,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {toValue: 8, duration: 80, useNativeDriver: true}),
      Animated.timing(shake, {toValue: 0, duration: 80, useNativeDriver: true}),
    ]).start();

    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(warningBlink, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(warningBlink, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );

    blinkLoop.start();

    rippleValues.forEach((value, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 220),
          Animated.timing(value, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    Animated.timing(progressWidth, {
      toValue: 0,
      duration: 10000,
      useNativeDriver: false,
    }).start();

    countdownRef.current = setInterval(() => {
      setCountdown(previous => {
        if (previous <= 1) {
          clearTimers();
          handleSOS();
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      blinkLoop.stop();
      clearTimers();
    };
  }, [
    clearTimers,
    crashDetected,
    handleSOS,
    progressWidth,
    rippleValues,
    shake,
    warningBlink,
  ]);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={crashDetected}
      onRequestClose={handleCancel}>
      <View style={styles.container}>
        <Animated.View
          style={[styles.content, {transform: [{translateX: shake}]}]}>
          <View style={styles.rippleContainer}>
            {rippleValues.map((value, index) => {
              const ringStyle = {
                opacity: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 0],
                }),
                transform: [
                  {
                    scale: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.4],
                    }),
                  },
                ],
              };

              return (
                <Animated.View
                  key={`ring-${index}`}
                  style={[styles.ripple, ringStyle]}
                />
              );
            })}
            <Animated.Text style={[styles.warning, {opacity: warningBlink}]}>
              ⚠️
            </Animated.Text>
          </View>

          <Text style={styles.title}>CRASH DETECTED</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SEVERITY: CRITICAL</Text>
          </View>
          <Text style={styles.countdown}>{countdown}</Text>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, {width: progressWidth}]}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSOS}
            style={styles.sosButton}>
            <Text style={styles.sosButtonText}>🚨 SEND SOS NOW</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleCancel}
            style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>✕ FALSE ALARM — CANCEL</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(5,0,2,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
  },
  rippleContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ripple: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: COLORS.PINK,
  },
  warning: {
    fontSize: 52,
  },
  title: {
    fontSize: 22,
    color: COLORS.PINK,
    fontWeight: '800',
    letterSpacing: 3,
  },
  badge: {
    backgroundColor: 'rgba(255,61,107,0.1)',
    borderColor: COLORS.PINK,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  badgeText: {
    color: COLORS.PINK,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  countdown: {
    marginTop: 18,
    color: COLORS.PINK,
    fontSize: 56,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  progressTrack: {
    width: 280,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 28,
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.PINK,
  },
  sosButton: {
    backgroundColor: COLORS.PINK,
    borderRadius: 14,
    width: 280,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  cancelButton: {
    width: 280,
    height: 46,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: COLORS.MUTED2,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
