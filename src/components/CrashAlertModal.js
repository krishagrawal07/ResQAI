import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal, StyleSheet, Text, Vibration, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AnimatedReanimated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import {CountdownProgressRing} from './EmergencyAnimations';
import {EmergencyGlowBorder, RipplePressable} from './MicroInteractions';
import {useAppContext} from '../context/AppContext';
import BackendService from '../services/BackendService';
import CrashDetectionService from '../services/CrashDetectionService';
import FirebaseService from '../services/FirebaseService';
import LiveTrackingService from '../services/LiveTrackingService';
import LocationService from '../services/LocationService';
import NotificationService from '../services/NotificationService';
import SMSService from '../services/SMSService';
import {COLORS, FONTS, STORAGE_KEYS} from '../utils/constants';

function CrashRipple({index, pulse}) {
  const ringStyle = useAnimatedStyle(() => {
    const phase = (pulse.value + index * 0.22) % 1;

    return {
      opacity: interpolate(phase, [0, 1], [0.78, 0]),
      transform: [{scale: interpolate(phase, [0, 1], [1, 1.55])}],
    };
  });

  return <AnimatedReanimated.View style={[styles.ripple, ringStyle]} />;
}

export default function CrashAlertModal() {
  const navigation = useNavigation();
  const {
    state: {
      crashDetected,
      crashMeta,
      emergencyPlan,
      location,
      mode,
      preferences,
      sensors,
      userProfile,
    },
    dispatch,
  } = useAppContext();
  const [countdown, setCountdown] = useState(10);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  const warningPulse = useSharedValue(0);
  const ripplePulse = useSharedValue(0);
  const countdownRef = useRef(null);
  const isHandlingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    clearTimers();
    NotificationService.stopAlarm();
    Vibration.cancel();
    dispatch({type: 'RESET_CRASH'});
  }, [clearTimers, dispatch]);

  const handleSOS = useCallback(async () => {
    if (isHandlingRef.current) {
      return;
    }

    isHandlingRef.current = true;
    clearTimers();
    NotificationService.stopAlarm();
    Vibration.cancel();
    dispatch({type: 'SOS_TRIGGERED'});

    let resolvedLocation = location;
    let backendIncident = null;
    const fallbackSeverity = CrashDetectionService.previewSeverity(sensors, {
      speedBeforeKmh: Math.max(sensors.speed + 30, 45),
    });
    const includeGuardianMode = Boolean(preferences.guardianMode);
    const includeMedicalCard = Boolean(preferences.shareMedicalCard);
    const includeNearbyResponders = Boolean(preferences.notifyNearbyResponders);
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
    const crashSnapshot = crashMeta?.snapshot ?? fallbackSeverity.snapshot;
    const crashSeverity = crashMeta?.severity ?? fallbackSeverity.severity;

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

    const nearbyPolice = includeNearbyResponders
      ? await LocationService.getNearbyPlaces(
          resolvedLocation.lat,
          resolvedLocation.lng,
          'police',
        )
      : [];

    try {
      backendIncident = await BackendService.createIncident({
        dispatchPreferences: {
          guardianMode: includeGuardianMode,
          notifyNearbyResponders: includeNearbyResponders,
        },
        emergencyPlan: incidentEmergencyPlan,
        location: resolvedLocation,
        metadata: {
          appVersion: 'mobile-mvp',
          detectedAt: crashMeta?.detectedAt || new Date().toISOString(),
          source: 'mobile-app',
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
      dispatch({type: 'SET_ACTIVE_INCIDENT', payload: backendIncident});
    } catch (backendError) {
      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {startupMode: 'preview'},
      });

      await SMSService.sendEmergencySMS(
        incidentUserProfile,
        resolvedLocation,
        nearbyPolice,
        {
          includeGuardianMode,
          includeNearbyResponders,
        },
      );
    }

    await Promise.allSettled([
      FirebaseService.logCrashEvent(
        sensors,
        resolvedLocation,
        FirebaseService.getCurrentUserId(),
      ),
    ]);

    if (backendIncident?.id) {
      await LiveTrackingService.start({
        incidentId: backendIncident.id,
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

    navigation.navigate('Dispatch');
  }, [
    clearTimers,
    crashMeta,
    dispatch,
    emergencyPlan,
    location,
    mode,
    navigation,
    preferences.guardianMode,
    preferences.notifyNearbyResponders,
    preferences.shareMedicalCard,
    sensors,
    userProfile,
  ]);

  useEffect(() => {
    if (!crashDetected) {
      clearTimers();
      return undefined;
    }

    isHandlingRef.current = false;
    setCountdown(10);
    NotificationService.hapticAlert();
    NotificationService.playSoftAlertTone({volume: 0.16});
    NotificationService.triggerCrashAlarm({
      silentDispatch: preferences.silentDispatch,
    });
    if (preferences.voicePrompts) {
      NotificationService.announcePrompt(
        'Possible crash detected. Sending emergency alert in ten seconds.',
      );
    }

    shake.value = withSequence(
      withTiming(-10, {duration: 70, easing: Easing.out(Easing.cubic)}),
      withTiming(10, {duration: 70, easing: Easing.out(Easing.cubic)}),
      withTiming(-7, {duration: 64, easing: Easing.out(Easing.cubic)}),
      withTiming(7, {duration: 64, easing: Easing.out(Easing.cubic)}),
      withTiming(-3, {duration: 56, easing: Easing.out(Easing.cubic)}),
      withTiming(0, {duration: 120, easing: Easing.out(Easing.cubic)}),
    );
    flash.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 540,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0.18, {
          duration: 540,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
      -1,
      false,
    );
    warningPulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, {
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
      -1,
      false,
    );
    ripplePulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1350,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {duration: 0}),
      ),
      -1,
      false,
    );

    countdownRef.current = setInterval(() => {
      setCountdown(previous => {
        const nextValue = previous - 1;
        if (previous <= 1) {
          clearTimers();
          if (preferences.voicePrompts) {
            NotificationService.announcePrompt('Sending emergency alert now.');
          }
          handleSOS();
          return 0;
        }

        if (preferences.voicePrompts && [5, 3, 2, 1].includes(nextValue)) {
          NotificationService.announcePrompt(`Sending SOS in ${nextValue}`);
        }

        return nextValue;
      });
    }, 1000);

    return () => {
      cancelAnimation(shake);
      cancelAnimation(flash);
      cancelAnimation(warningPulse);
      cancelAnimation(ripplePulse);
      Vibration.cancel();
      clearTimers();
    };
  }, [
    clearTimers,
    crashDetected,
    flash,
    handleSOS,
    preferences.silentDispatch,
    preferences.voicePrompts,
    ripplePulse,
    shake,
    warningPulse,
  ]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{translateX: shake.value}],
  }));
  const redFlashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flash.value, [0, 1], [0.2, 0.68]),
  }));
  const alertPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(warningPulse.value, [0, 1], [0.45, 1]),
  }));
  const warningCoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(warningPulse.value, [0, 1], [0.72, 1]),
    transform: [
      {scale: interpolate(warningPulse.value, [0, 1], [0.96, 1.035])},
    ],
  }));

  return (
    <Modal
      animationType="fade"
      transparent
      visible={crashDetected}
      onRequestClose={handleCancel}>
      <View style={styles.container}>
        <AnimatedReanimated.View
          pointerEvents="none"
          style={[styles.redFlashLayer, redFlashStyle]}
        />
        <View pointerEvents="none" style={styles.scanGrid} />
        <AnimatedReanimated.View style={[styles.content, shakeStyle]}>
          <EmergencyGlowBorder active style={styles.panelGlow}>
            <LinearGradient
              colors={['rgba(255, 59, 48, 0.22)', 'rgba(13, 13, 13, 0.94)']}
              end={{x: 1, y: 1}}
              start={{x: 0, y: 0}}
              style={styles.panel}>
              <View style={styles.alertHeader}>
                <View style={styles.alertPill}>
                  <AnimatedReanimated.View
                    style={[styles.alertDot, alertPulseStyle]}
                  />
                  <Text style={styles.alertPillText}>Crash Detection</Text>
                </View>
                <Text style={styles.alertHint}>Auto-SOS in progress</Text>
              </View>

              <View style={styles.rippleContainer}>
                {[0, 1, 2].map(index => (
                  <CrashRipple
                    index={index}
                    key={`ring-${index}`}
                    pulse={ripplePulse}
                  />
                ))}

                <AnimatedReanimated.View style={warningCoreStyle}>
                  <LinearGradient
                    colors={[COLORS.PRIMARY, '#7A0B07']}
                    style={styles.warningCore}>
                    <Ionicons
                      color="#FFFFFF"
                      name="warning-outline"
                      size={48}
                    />
                  </LinearGradient>
                </AnimatedReanimated.View>
              </View>

              <Text style={styles.title}>Possible crash detected</Text>
              <Text style={styles.copy}>
                If you are safe, cancel now. If there is no response, ResQ AI
                will send your location, medical card, and emergency contacts.
              </Text>

              <View style={styles.timerCard}>
                <CountdownProgressRing
                  active={crashDetected}
                  countdown={countdown}
                />
              </View>

              <View style={styles.severityRow}>
                <Text style={styles.severityLabel}>AI severity</Text>
                <Text style={styles.severityValue}>
                  {crashMeta?.severity?.label || 'Assessing'}
                </Text>
              </View>

              <RipplePressable
                contentStyle={styles.buttonPressContent}
                haptic="medium"
                onPress={handleCancel}
                rippleColor="rgba(13,13,13,0.2)"
                style={styles.cancelButton}>
                <Ionicons color={COLORS.BG} name="close-circle" size={22} />
                <Text style={styles.cancelButtonText}>Cancel Alert</Text>
              </RipplePressable>

              <RipplePressable
                contentStyle={styles.buttonPressContent}
                haptic="heavy"
                onPress={handleSOS}
                rippleColor="rgba(255, 59, 48, 0.28)"
                style={styles.sosButton}>
                <Ionicons
                  color="#FFFFFF"
                  name="paper-plane-outline"
                  size={18}
                />
                <Text style={styles.sosButtonText}>Send SOS now</Text>
              </RipplePressable>
            </LinearGradient>
          </EmergencyGlowBorder>
        </AnimatedReanimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(13, 13, 13, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  redFlashLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.PRIMARY,
  },
  scanGrid: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    width: '100%',
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 28},
    shadowOpacity: 0.42,
    shadowRadius: 40,
    elevation: 18,
  },
  panelGlow: {
    width: '100%',
  },
  panel: {
    width: '100%',
    borderRadius: 34,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  alertHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY,
    marginRight: 8,
  },
  alertPillText: {
    color: COLORS.TEXT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FONTS.strong,
  },
  alertHint: {
    color: COLORS.MUTED2,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.strong,
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
    borderColor: COLORS.PRIMARY,
  },
  warningCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  title: {
    fontSize: 28,
    color: COLORS.TEXT,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: FONTS.heading,
  },
  severityRow: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.36)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginRight: 8,
    fontFamily: FONTS.body,
  },
  severityValue: {
    color: COLORS.ACCENT,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: FONTS.strong,
  },
  copy: {
    marginTop: 14,
    color: COLORS.TEXT_DIM,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 14,
    fontFamily: FONTS.body,
  },
  timerCard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 18,
    marginTop: 20,
  },
  buttonPressContent: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sosButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    width: '100%',
    height: 52,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
    fontFamily: FONTS.strong,
  },
  cancelButton: {
    width: '100%',
    height: 66,
    marginTop: 22,
    borderRadius: 24,
    backgroundColor: COLORS.TEXT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.TEXT,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  cancelButtonText: {
    color: COLORS.BG,
    fontSize: 17,
    fontWeight: '900',
    marginLeft: 8,
    fontFamily: FONTS.strong,
  },
});
