import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedReanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import CrashAlertModal from '../components/CrashAlertModal';
import RadarAnimation from '../components/RadarAnimation';
import SensorCard from '../components/SensorCard';
import {useAppContext} from '../context/AppContext';
import CrashDetectionService from '../services/CrashDetectionService';
import NotificationService from '../services/NotificationService';
import SensorService from '../services/SensorService';
import {COLORS, CRASH_THRESHOLDS, STORAGE_KEYS} from '../utils/constants';
import {formatModeLabel, toPercentage} from '../utils/helpers';

export default function MonitorScreen() {
  const {state, dispatch} = useAppContext();
  const blink = useRef(new Animated.Value(1)).current;
  const pulse = useSharedValue(0);

  const handleCrashDetected = useCallback(() => {
    dispatch({type: 'CRASH_DETECTED'});
    NotificationService.triggerCrashAlarm();
  }, [dispatch]);

  const handleSensorUpdate = useCallback(
    nextSensors => {
      dispatch({type: 'UPDATE_SENSORS', payload: nextSensors});
    },
    [dispatch],
  );

  const handleLocationUpdate = useCallback(
    nextLocation => {
      dispatch({type: 'SET_LOCATION', payload: nextLocation});
    },
    [dispatch],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    if (state.isMonitoring) {
      loop.start();
    } else {
      blink.setValue(1);
    }

    return () => loop.stop();
  }, [blink, state.isMonitoring]);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, {duration: 1400}), -1, true);
  }, [pulse]);

  useEffect(() => {
    CrashDetectionService.setMode(state.mode);

    if (state.isMonitoring) {
      SensorService.startMonitoring({
        mode: state.mode,
        onSensorUpdate: handleSensorUpdate,
        onLocationUpdate: handleLocationUpdate,
        onCrash: handleCrashDetected,
      });
    }
  }, [
    handleCrashDetected,
    handleLocationUpdate,
    handleSensorUpdate,
    state.isMonitoring,
    state.mode,
  ]);

  const simulateButtonStyle = useAnimatedStyle(() => ({
    transform: [{scale: interpolate(pulse.value, [0, 1], [1, 1.02])}],
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.15, 0.55]),
  }));

  const handleModeSelect = async nextMode => {
    const nextProfile = {...state.userProfile, vehicleMode: nextMode};
    dispatch({type: 'SET_MODE', payload: nextMode});
    dispatch({type: 'SET_USER_PROFILE', payload: nextProfile});
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_PROFILE,
      JSON.stringify(nextProfile),
    );
  };

  const handleMonitoringToggle = async () => {
    if (state.isMonitoring) {
      await SensorService.stopMonitoring();
      dispatch({type: 'SET_MONITORING', payload: false});
      return;
    }

    await SensorService.startMonitoring({
      mode: state.mode,
      onSensorUpdate: handleSensorUpdate,
      onLocationUpdate: handleLocationUpdate,
      onCrash: handleCrashDetected,
    });
    dispatch({type: 'SET_MONITORING', payload: true});
  };

  const handleSimulateCrash = () => {
    const simulated = SensorService.simulateCrash(state.mode);
    dispatch({type: 'UPDATE_SENSORS', payload: simulated});
    dispatch({type: 'CRASH_DETECTED'});
    NotificationService.triggerCrashAlarm();
  };

  const threshold = CRASH_THRESHOLDS[state.mode];

  const sensorCards = useMemo(
    () => [
      {
        label: 'ACCEL-X',
        value: state.sensors.ax,
        unit: 'm/s²',
        color: COLORS.CYAN,
        percentage: toPercentage(state.sensors.ax, threshold.accelMagnitude),
      },
      {
        label: 'ACCEL-Y',
        value: state.sensors.ay,
        unit: 'm/s²',
        color: COLORS.CYAN,
        percentage: toPercentage(state.sensors.ay, threshold.accelMagnitude),
      },
      {
        label: 'GYRO-X',
        value: state.sensors.gx,
        unit: '°/s',
        color: COLORS.PINK,
        percentage: toPercentage(state.sensors.gx, threshold.gyroMagnitude),
      },
      {
        label: 'GYRO-Y',
        value: state.sensors.gy,
        unit: '°/s',
        color: COLORS.PINK,
        percentage: toPercentage(state.sensors.gy, threshold.gyroMagnitude),
      },
      {
        label: 'SPEED',
        value: state.sensors.speed,
        unit: 'km/h',
        color: COLORS.GREEN,
        percentage: toPercentage(state.sensors.speed, 120),
      },
      {
        label: 'AUDIO dB',
        value: state.sensors.db,
        unit: 'dB',
        color: COLORS.YELLOW,
        percentage: toPercentage(state.sensors.db, threshold.audioDb + 10),
      },
    ],
    [state.sensors, threshold],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <RadarAnimation />
          <View style={styles.statusRow}>
            <Animated.View
              style={[
                styles.statusDot,
                {
                  backgroundColor: state.isMonitoring
                    ? COLORS.GREEN
                    : COLORS.MUTED,
                  opacity: blink,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {color: state.isMonitoring ? COLORS.GREEN : COLORS.MUTED2},
              ]}>
              {state.isMonitoring ? 'MONITORING ACTIVE' : 'MONITORING STANDBY'}
            </Text>
          </View>
          <Text style={styles.modeSubtitle}>{formatModeLabel(state.mode)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Vehicle Mode</Text>
        <View style={styles.modeRow}>
          {[
            {label: '🏍️\nBIKER MODE', value: 'biker'},
            {label: '🚗\nCAR MODE', value: 'car'},
          ].map(option => (
            <TouchableOpacity
              activeOpacity={0.9}
              key={option.value}
              onPress={() => handleModeSelect(option.value)}
              style={[
                styles.modeCard,
                state.mode === option.value ? styles.modeCardActive : null,
              ]}>
              <Text
                style={[
                  styles.modeCardText,
                  state.mode === option.value
                    ? styles.modeCardTextActive
                    : null,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Live Sensor Grid</Text>
        <View style={styles.grid}>
          {sensorCards.map(card => (
            <SensorCard key={card.label} {...card} />
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleMonitoringToggle}
          style={[
            styles.monitorToggle,
            state.isMonitoring
              ? styles.monitorToggleActive
              : styles.monitorToggleIdle,
          ]}>
          <Text
            style={[
              styles.monitorToggleText,
              {color: state.isMonitoring ? COLORS.GREEN : COLORS.TEXT},
            ]}>
            {state.isMonitoring
              ? '■ STOP MONITORING'
              : 'TAP TO START MONITORING'}
          </Text>
        </TouchableOpacity>

        <AnimatedReanimated.View
          style={[styles.simulateWrapper, simulateButtonStyle]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSimulateCrash}
            style={styles.simulateButton}>
            <Text style={styles.simulateButtonText}>💥 SIMULATE CRASH</Text>
          </TouchableOpacity>
        </AnimatedReanimated.View>
      </ScrollView>

      <CrashAlertModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.08)',
    marginBottom: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: '700',
  },
  modeSubtitle: {
    marginTop: 10,
    color: COLORS.MUTED2,
    textAlign: 'center',
    fontSize: 13,
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  modeCard: {
    flex: 1,
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.MUTED,
    alignItems: 'center',
    marginRight: 10,
  },
  modeCardActive: {
    borderColor: COLORS.CYAN,
    backgroundColor: 'rgba(0,229,255,0.06)',
  },
  modeCardText: {
    color: COLORS.TEXT,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '700',
  },
  modeCardTextActive: {
    color: COLORS.CYAN,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monitorToggle: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorToggleIdle: {
    backgroundColor: COLORS.BG3,
    borderColor: COLORS.MUTED,
  },
  monitorToggleActive: {
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderColor: COLORS.GREEN,
  },
  monitorToggleText: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  simulateWrapper: {
    shadowColor: COLORS.PINK,
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 16,
    elevation: 8,
  },
  simulateButton: {
    marginTop: 14,
    height: 58,
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#1a0008',
    borderWidth: 2,
    borderColor: COLORS.PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateButtonText: {
    color: COLORS.PINK,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
