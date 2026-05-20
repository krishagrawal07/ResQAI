import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal, StyleSheet, Text, Vibration, View} from 'react-native';
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
import EmergencyService from '../services/EmergencyService';
import NotificationService from '../services/NotificationService';
import {COLORS, CRASH_SCORING, FONTS} from '../utils/constants';

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
  const {state, dispatch} = useAppContext();
  const {crashDetected, crashMeta, preferences} = state;
  const latestStateRef = useRef(state);
  const [countdown, setCountdown] = useState(CRASH_SCORING.countdownSeconds);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  const warningPulse = useSharedValue(0);
  const ripplePulse = useSharedValue(0);
  const countdownRef = useRef(null);
  const isHandlingRef = useRef(false);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleSafeConfirmation = useCallback(() => {
    clearTimers();
    NotificationService.stopAlarm();
    Vibration.cancel();
    dispatch({type: 'RESET_CRASH'});
  }, [clearTimers, dispatch]);

  const triggerEmergencyAlert = useCallback(async () => {
    if (isHandlingRef.current) {
      return;
    }

    isHandlingRef.current = true;
    clearTimers();
    NotificationService.stopAlarm();
    Vibration.cancel();
    const latestState = latestStateRef.current;
    try {
      await EmergencyService.triggerSOS({
        crashMetaOverride: latestState.crashMeta,
        dispatch,
        source: 'crash-countdown',
        state: latestState,
      });

      navigation.navigate('Dispatch');
    } catch (error) {
      isHandlingRef.current = false;
      console.log('Crash countdown SOS failed', error);
      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {
          lastSosError: error?.message || 'Emergency alert could not be sent',
          startupMode: 'local-sos',
        },
      });
    }
  }, [clearTimers, dispatch, navigation]);

  useEffect(() => {
    if (!crashDetected) {
      clearTimers();
      return undefined;
    }

    isHandlingRef.current = false;
    setCountdown(CRASH_SCORING.countdownSeconds);
    NotificationService.hapticAlert().catch(error => {
      console.log('Crash alert haptic failed', error);
    });
    NotificationService.playSoftAlertTone({volume: 0.16}).catch(error => {
      console.log('Crash alert tone failed', error);
    });
    NotificationService.triggerCrashAlarm({
      silentDispatch: preferences.silentDispatch,
    }).catch(error => {
      console.log('Crash alarm failed', error);
    });
    if (preferences.voicePrompts) {
      NotificationService.announcePrompt(
        'Possible accident detected. Are you safe? Emergency alert starts in ten seconds.',
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
          triggerEmergencyAlert();
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
    triggerEmergencyAlert,
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
      onRequestClose={handleSafeConfirmation}>
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
                <Text style={styles.alertHint}>SOS countdown active</Text>
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

              <Text style={styles.title}>
                Possible accident detected. Are you safe?
              </Text>
              <Text style={styles.copy}>
                Tap "I'm Safe" to cancel. If there is no response after ten
                seconds, ResQ AI will trigger your emergency alert.
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
                onPress={handleSafeConfirmation}
                rippleColor="rgba(13,13,13,0.2)"
                style={styles.cancelButton}>
                <Ionicons color={COLORS.BG} name="close-circle" size={22} />
                <Text style={styles.cancelButtonText}>I'm Safe</Text>
              </RipplePressable>

              <RipplePressable
                contentStyle={styles.buttonPressContent}
                haptic="heavy"
                onPress={triggerEmergencyAlert}
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
