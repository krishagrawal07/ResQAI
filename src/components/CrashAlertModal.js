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
import Ionicons from 'react-native-vector-icons/Ionicons';
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
        toValue: -10,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 10,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -6,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 6,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {toValue: 0, duration: 70, useNativeDriver: true}),
    ]).start();

    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(warningBlink, {
          toValue: 0.25,
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
                  outputRange: [0.82, 0],
                }),
                transform: [
                  {
                    scale: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.45],
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

            <Animated.View style={{opacity: warningBlink}}>
              <View style={styles.warningCore}>
                <Ionicons
                  color={COLORS.PINK}
                  name="warning-outline"
                  size={42}
                />
              </View>
            </Animated.View>
          </View>

          <Text style={styles.title}>Possible crash detected</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Emergency countdown is active</Text>
          </View>
          <Text style={styles.copy}>
            If you are safe, cancel now. If there is no response, ResQ AI will
            continue the SOS flow automatically.
          </Text>
          <Text style={styles.countdown}>{countdown}</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, {width: progressWidth}]}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleSOS}
            style={styles.sosButton}>
            <Ionicons color="#FFFFFF" name="paper-plane-outline" size={18} />
            <Text style={styles.sosButtonText}>Send SOS now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleCancel}
            style={styles.cancelButton}>
            <Ionicons color={COLORS.TEXT} name="close-outline" size={18} />
            <Text style={styles.cancelButtonText}>I am safe, cancel alert</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 22, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  content: {
    width: '100%',
    backgroundColor: '#120B18',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 138, 0.26)',
    alignItems: 'center',
  },
  rippleContainer: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ripple: {
    position: 'absolute',
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 2,
    borderColor: COLORS.PINK,
  },
  warningCore: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255, 92, 138, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: COLORS.TEXT,
    fontWeight: '800',
    textAlign: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255, 92, 138, 0.12)',
    borderColor: COLORS.PINK,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  badgeText: {
    color: COLORS.PINK,
    fontSize: 12,
    fontWeight: '800',
  },
  copy: {
    marginTop: 14,
    color: COLORS.TEXT_DIM,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 14,
  },
  countdown: {
    marginTop: 18,
    color: COLORS.PINK,
    fontSize: 58,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  progressTrack: {
    width: 280,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 24,
  },
  progressFill: {
    height: 7,
    backgroundColor: COLORS.PINK,
  },
  sosButton: {
    backgroundColor: COLORS.PINK,
    borderRadius: 18,
    width: '100%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  cancelButton: {
    width: '100%',
    height: 50,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButtonText: {
    color: COLORS.TEXT,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
});
