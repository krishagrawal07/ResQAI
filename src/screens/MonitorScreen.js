import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AnimatedReanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AuroraBackground from '../components/AuroraBackground';
import BrandMark from '../components/BrandMark';
import CrashAlertModal from '../components/CrashAlertModal';
import {
  PulsingSafetyIndicator,
  ReanimatedStatusDot,
} from '../components/EmergencyAnimations';
import LiveMap from '../components/LiveMap';
import {RipplePressable} from '../components/MicroInteractions';
import RevealView from '../components/RevealView';
import SensorCard from '../components/SensorCard';
import {useAppContext} from '../context/AppContext';
import CrashDetectionService from '../services/CrashDetectionService';
import LocationService from '../services/LocationService';
import NotificationService from '../services/NotificationService';
import SensorService from '../services/SensorService';
import {
  COLORS,
  CRASH_THRESHOLDS,
  FONTS,
  MODE_META,
  STORAGE_KEYS,
} from '../utils/constants';
import {
  formatModeLabel,
  formatModeShortLabel,
  toPercentage,
} from '../utils/helpers';
import {requestAllPermissions} from '../utils/permissions';

const QUICK_ACTIONS = [
  {
    key: 'location',
    icon: 'locate-outline',
    title: 'Refresh location',
    subtitle: 'Try a fresh GPS lock',
  },
  {
    key: 'drill',
    icon: 'flash-outline',
    title: 'Run rescue drill',
    subtitle: 'Preview the crash flow',
  },
  {
    key: 'safety',
    icon: 'settings-outline',
    title: 'Tune protection',
    subtitle: 'Open Safety tab',
  },
  {
    key: 'insights',
    icon: 'analytics-outline',
    title: 'Open insights',
    subtitle: 'Review rescue status',
  },
];

export default function MonitorScreen({navigation}) {
  const {state, dispatch} = useAppContext();
  const pulse = useSharedValue(0);
  const autoArmHandledRef = useRef(false);

  const handleCrashDetected = useCallback(
    detectionPayload => {
      dispatch({type: 'CRASH_DETECTED', payload: detectionPayload});
    },
    [dispatch],
  );

  const triggerSimulatedCrash = useCallback(() => {
    NotificationService.playSoftAlertTone({volume: 0.22});
    const simulated = SensorService.simulateCrash(state.mode);
    const severityPreview = CrashDetectionService.previewSeverity(simulated, {
      speedBeforeKmh: Math.max(48, state.sensors.speed || 0),
    });

    dispatch({type: 'UPDATE_SENSORS', payload: simulated});
    dispatch({
      type: 'CRASH_DETECTED',
      payload: {
        detectedAt: new Date().toISOString(),
        severity: severityPreview.severity,
        snapshot: severityPreview.snapshot,
      },
    });
  }, [dispatch, state.mode, state.sensors.speed]);

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

  const handleStatusChange = useCallback(
    nextStatus => {
      dispatch({type: 'SET_RUNTIME_STATUS', payload: nextStatus});
    },
    [dispatch],
  );

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, {duration: 1600}), -1, true);
  }, [pulse]);

  useEffect(() => {
    CrashDetectionService.setMode(state.mode);
    CrashDetectionService.setSensitivity(
      state.preferences.detectionSensitivity,
    );

    if (state.isMonitoring) {
      SensorService.startMonitoring({
        mode: state.mode,
        onSensorUpdate: handleSensorUpdate,
        onLocationUpdate: handleLocationUpdate,
        onCrash: handleCrashDetected,
        onStatusChange: handleStatusChange,
      });
    }
  }, [
    handleCrashDetected,
    handleLocationUpdate,
    handleSensorUpdate,
    handleStatusChange,
    state.isMonitoring,
    state.mode,
    state.preferences.detectionSensitivity,
  ]);

  const simulateButtonStyle = useAnimatedStyle(() => ({
    transform: [{scale: interpolate(pulse.value, [0, 1], [1, 1.03])}],
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

  const startMonitoring = useCallback(async () => {
    const permissions = await requestAllPermissions();
    const liveReady =
      permissions.location && permissions.microphone && permissions.activity;

    dispatch({
      type: 'SET_RUNTIME_STATUS',
      payload: {
        permissions,
        startupMode: liveReady ? 'live' : 'preview',
      },
    });
    dispatch({type: 'SET_MONITORING', payload: true});
  }, [dispatch]);

  const stopMonitoring = useCallback(async () => {
    await SensorService.stopMonitoring();
    dispatch({type: 'SET_MONITORING', payload: false});
    dispatch({
      type: 'SET_RUNTIME_STATUS',
      payload: {sensorSource: 'idle'},
    });
  }, [dispatch]);

  const handleMonitoringToggle = useCallback(async () => {
    NotificationService.playSoftAlertTone({volume: 0.12});

    if (state.isMonitoring) {
      await stopMonitoring();
      return;
    }

    await startMonitoring();
  }, [startMonitoring, state.isMonitoring, stopMonitoring]);

  useEffect(() => {
    if (!state.preferences.autoArm) {
      autoArmHandledRef.current = false;
      return;
    }

    if (state.isMonitoring || autoArmHandledRef.current) {
      return;
    }

    autoArmHandledRef.current = true;
    startMonitoring();
  }, [startMonitoring, state.isMonitoring, state.preferences.autoArm]);

  const handleSimulateCrash = () => {
    triggerSimulatedCrash();
  };

  const handleQuickAction = async key => {
    if (key === 'drill') {
      triggerSimulatedCrash();
      return;
    }

    if (key === 'safety') {
      navigation.navigate('Safety');
      return;
    }
    if (key === 'insights') {
      navigation.navigate('Insights');
      return;
    }

    try {
      const currentLocation = await LocationService.getCurrentLocation();
      dispatch({type: 'SET_LOCATION', payload: currentLocation});
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_LOCATION,
        JSON.stringify(currentLocation),
      );
    } catch (error) {
      dispatch({
        type: 'SET_RUNTIME_STATUS',
        payload: {startupMode: 'preview'},
      });
    }
  };

  const threshold = CRASH_THRESHOLDS[state.mode] ?? CRASH_THRESHOLDS.biker;
  const modeOptions = Object.values(MODE_META);
  const activeMode = MODE_META[state.mode] ?? MODE_META.biker;
  const liveReady =
    state.runtime.permissions.location &&
    state.runtime.permissions.microphone &&
    state.runtime.permissions.activity;

  const readinessItems = [
    {
      key: 'guardianMode',
      icon: 'people-outline',
      label: 'Guardian mode',
      active: state.preferences.guardianMode,
    },
    {
      key: 'shareMedicalCard',
      icon: 'medkit-outline',
      label: 'Medical card',
      active: state.preferences.shareMedicalCard,
    },
    {
      key: 'autoArm',
      icon: 'shield-outline',
      label: 'Auto arm',
      active: state.preferences.autoArm,
    },
    {
      key: 'voicePrompts',
      icon: 'volume-high-outline',
      label: 'Voice prompts',
      active: state.preferences.voicePrompts,
    },
  ];
  const readinessIconStyles = {
    active: styles.readinessIconActive,
    inactive: styles.readinessIconInactive,
  };
  const sensorFeedValue =
    state.runtime.sensorSource === 'live'
      ? 'Live'
      : state.runtime.sensorSource === 'preview'
      ? 'Preview'
      : 'Idle';
  const rescueLaneValue = state.preferences.guardianMode ? 'Guardian' : 'Solo';
  const heroSignals = [
    {
      key: 'mode',
      icon: activeMode.icon,
      label: 'Profile',
      value: formatModeShortLabel(state.mode),
      accent: activeMode.accent,
    },
    {
      key: 'feed',
      icon: state.runtime.sensorSource === 'live' ? 'radio' : 'sparkles',
      label: 'Sensor',
      value: sensorFeedValue,
      accent: liveReady ? COLORS.CYAN : COLORS.YELLOW,
    },
    {
      key: 'lane',
      icon: state.preferences.guardianMode
        ? 'people-circle'
        : 'person-circle-outline',
      label: 'Rescue',
      value: rescueLaneValue,
      accent: state.preferences.guardianMode ? COLORS.GREEN : COLORS.PINK,
    },
  ];

  const sensorCards = useMemo(
    () => [
      {
        label: 'Accel X',
        value: state.sensors.ax,
        unit: 'm/s2',
        color: COLORS.CYAN,
        icon: 'resize-outline',
        hint: 'Lateral motion',
        percentage: toPercentage(state.sensors.ax, threshold.accelMagnitude),
      },
      {
        label: 'Accel Y',
        value: state.sensors.ay,
        unit: 'm/s2',
        color: COLORS.BLUE,
        icon: 'move-outline',
        hint: 'Forward motion',
        percentage: toPercentage(state.sensors.ay, threshold.accelMagnitude),
      },
      {
        label: 'Gyro X',
        value: state.sensors.gx,
        unit: 'deg/s',
        color: COLORS.PINK,
        icon: 'sync-outline',
        hint: 'Tilt rotation',
        percentage: toPercentage(state.sensors.gx, threshold.gyroMagnitude),
      },
      {
        label: 'Gyro Y',
        value: state.sensors.gy,
        unit: 'deg/s',
        color: COLORS.ORANGE,
        icon: 'refresh-outline',
        hint: 'Yaw rotation',
        percentage: toPercentage(state.sensors.gy, threshold.gyroMagnitude),
      },
      {
        label: 'Speed',
        value: state.sensors.speed,
        unit: 'km/h',
        color: COLORS.GREEN,
        icon: 'speedometer-outline',
        hint: 'Travel velocity',
        percentage: toPercentage(state.sensors.speed, 120),
      },
      {
        label: 'Cabin audio',
        value: state.sensors.db,
        unit: 'dB',
        color: COLORS.YELLOW,
        icon: 'mic-outline',
        hint: 'Impact noise level',
        percentage: toPercentage(state.sensors.db, threshold.audioDb + 10),
      },
    ],
    [state.sensors, threshold],
  );

  return (
    <View style={styles.container}>
      <AuroraBackground variant="monitor" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <RevealView delay={40}>
          <LinearGradient
            colors={['rgba(28, 28, 30, 0.94)', 'rgba(13, 13, 13, 0.88)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <BrandMark showWordmark size={58} />
              <View style={styles.heroStatusBadge}>
                <ReanimatedStatusDot
                  active={state.isMonitoring}
                  activeColor={COLORS.SUCCESS}
                  idleColor={COLORS.YELLOW}
                />
                <Text style={styles.heroStatusText}>
                  {state.isMonitoring ? 'Protection active' : 'Ready to arm'}
                </Text>
              </View>
            </View>

            <PulsingSafetyIndicator isMonitoring={state.isMonitoring} />

            <Text style={styles.heroTitle}>
              Emergency intelligence, always on
            </Text>
            <Text style={styles.heroCopy}>
              ResQ AI blends Apple Health clarity, Tesla-style telemetry, and
              Uber Safety urgency into one premium rescue cockpit. Configured
              for {formatModeLabel(state.mode)} mode with adaptive thresholds.
            </Text>

            <View style={styles.heroSignalsRow}>
              {heroSignals.map(signal => (
                <LinearGradient
                  colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)']}
                  end={{x: 1, y: 1}}
                  key={signal.key}
                  start={{x: 0, y: 0}}
                  style={styles.heroSignalBubble}>
                  <View
                    style={[
                      styles.heroSignalGlow,
                      {backgroundColor: `${signal.accent}1c`},
                    ]}
                  />
                  <View
                    style={[
                      styles.heroSignalIconWrap,
                      {backgroundColor: `${signal.accent}22`},
                    ]}>
                    <Ionicons
                      color={signal.accent}
                      name={signal.icon}
                      size={20}
                    />
                  </View>
                  <Text style={styles.heroSignalLabel}>{signal.label}</Text>
                  <Text numberOfLines={1} style={styles.heroSignalValue}>
                    {signal.value}
                  </Text>
                </LinearGradient>
              ))}
            </View>

            <View style={styles.heroActionRow}>
              <RipplePressable
                haptic={state.isMonitoring ? 'medium' : 'light'}
                onPress={handleMonitoringToggle}
                rippleColor="rgba(52, 199, 89, 0.22)"
                style={styles.armButton}>
                <LinearGradient
                  colors={
                    state.isMonitoring
                      ? ['rgba(255, 59, 48, 0.18)', 'rgba(255,255,255,0.05)']
                      : ['rgba(52, 199, 89, 0.26)', 'rgba(255,255,255,0.06)']
                  }
                  end={{x: 1, y: 1}}
                  start={{x: 0, y: 0}}
                  style={styles.armButtonGradient}>
                  <View style={styles.armIconWrap}>
                    <Ionicons
                      color={state.isMonitoring ? COLORS.RED : COLORS.SUCCESS}
                      name={
                        state.isMonitoring
                          ? 'pause-circle-outline'
                          : 'shield-checkmark'
                      }
                      size={24}
                    />
                  </View>
                  <View style={styles.armButtonCopy}>
                    <Text style={styles.armButtonLabel}>
                      {state.isMonitoring
                        ? 'Pause Protection'
                        : 'Arm Protection'}
                    </Text>
                    <Text style={styles.armButtonHint}>
                      {state.isMonitoring
                        ? 'Monitoring can be resumed anytime'
                        : 'Enable live crash detection'}
                    </Text>
                  </View>
                </LinearGradient>
              </RipplePressable>

              <AnimatedReanimated.View
                style={[styles.simulateButtonWrap, simulateButtonStyle]}>
                <RipplePressable
                  haptic="heavy"
                  onPress={handleSimulateCrash}
                  rippleColor="rgba(255,255,255,0.32)"
                  style={styles.simulateButtonTouch}>
                  <LinearGradient
                    colors={[COLORS.PRIMARY, '#B8120C']}
                    end={{x: 1, y: 1}}
                    start={{x: 0, y: 0}}
                    style={styles.simulateButton}>
                    <Ionicons color="#FFFFFF" name="flash" size={20} />
                    <Text style={styles.simulateButtonText}>
                      Simulate Crash
                    </Text>
                  </LinearGradient>
                </RipplePressable>
              </AnimatedReanimated.View>
            </View>

            <View style={styles.rescueStrip}>
              <View style={styles.rescueStripIcon}>
                <Ionicons color={COLORS.ACCENT} name="sparkles" size={16} />
              </View>
              <Text style={styles.rescueStripText}>
                Test mode triggers the same 10-second emergency countdown
                without waiting for a real impact.
              </Text>
            </View>
          </LinearGradient>
        </RevealView>

        <RevealView delay={110}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons
                color={liveReady ? COLORS.GREEN : COLORS.YELLOW}
                name={liveReady ? 'checkmark-circle' : 'information-circle'}
                size={20}
              />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>
                {liveReady
                  ? 'Live device mode ready'
                  : 'Preview mode is enabled'}
              </Text>
              <Text style={styles.noticeText}>
                {liveReady
                  ? 'Location, microphone, and motion access are available for live monitoring.'
                  : 'If some permissions are missing, the app keeps working with smart preview data instead of looking broken.'}
              </Text>
            </View>
          </View>
        </RevealView>

        <RevealView delay={170}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicle profiles</Text>
            <Text style={styles.sectionCaption}>
              {formatModeLabel(state.mode)}
            </Text>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.modeScroller}
            showsHorizontalScrollIndicator={false}>
            {modeOptions.map(option => {
              const selected = state.mode === option.value;

              return (
                <RipplePressable
                  contentStyle={styles.modePillContent}
                  haptic="light"
                  key={option.value}
                  onPress={() => handleModeSelect(option.value)}
                  style={[
                    styles.modePill,
                    selected ? styles.modePillActive : null,
                  ]}>
                  <View
                    style={[
                      styles.modeIconWrap,
                      {backgroundColor: `${option.accent}20`},
                    ]}>
                    <Ionicons
                      color={option.accent}
                      name={option.icon}
                      size={22}
                    />
                  </View>
                  <View style={styles.modeCopy}>
                    <Text
                      style={[
                        styles.modeTitle,
                        selected ? {color: option.accent} : null,
                      ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.modeSubtitle}>{option.subtitle}</Text>
                  </View>
                </RipplePressable>
              );
            })}
          </ScrollView>
        </RevealView>

        <RevealView delay={230}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <Text style={styles.sectionCaption}>
              Faster access to common tasks
            </Text>
          </View>

          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action, index) => (
              <RevealView
                delay={index * 50}
                key={action.key}
                style={styles.quickCardReveal}>
                <RipplePressable
                  haptic={action.key === 'drill' ? 'medium' : 'light'}
                  onPress={() => handleQuickAction(action.key)}
                  style={styles.quickCard}>
                  <View style={styles.quickIconWrap}>
                    <Ionicons
                      color={COLORS.CYAN}
                      name={action.icon}
                      size={20}
                    />
                  </View>
                  <Text style={styles.quickTitle}>{action.title}</Text>
                  <Text style={styles.quickSubtitle}>{action.subtitle}</Text>
                </RipplePressable>
              </RevealView>
            ))}
          </View>
        </RevealView>

        <RevealView delay={290}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Readiness board</Text>
            <Text style={styles.sectionCaption}>
              {activeMode.subtitle} with your current response stack
            </Text>
          </View>

          <View style={styles.readinessCard}>
            {readinessItems.map(item => (
              <View key={item.key} style={styles.readinessItem}>
                <View
                  style={[
                    styles.readinessIcon,
                    item.active
                      ? readinessIconStyles.active
                      : readinessIconStyles.inactive,
                  ]}>
                  <Ionicons
                    color={item.active ? COLORS.GREEN : COLORS.YELLOW}
                    name={item.icon}
                    size={18}
                  />
                </View>
                <Text style={styles.readinessLabel}>{item.label}</Text>
                <Text
                  style={[
                    styles.readinessValue,
                    {color: item.active ? COLORS.GREEN : COLORS.YELLOW},
                  ]}>
                  {item.active ? 'On' : 'Review'}
                </Text>
              </View>
            ))}
          </View>
        </RevealView>

        <RevealView delay={350}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Google GPS</Text>
            <Text style={styles.sectionCaption}>
              Connected to your phone GPS and centered on the latest lock
            </Text>
          </View>

          <LiveMap
            location={state.location}
            onUserLocationChange={handleLocationUpdate}
            title="Phone GPS monitor"
          />
        </RevealView>

        <RevealView delay={410}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live sensor studio</Text>
            <Text style={styles.sectionCaption}>
              {state.isMonitoring
                ? 'Telemetry is updating in real time'
                : 'Arm protection to watch the sensor grid move'}
            </Text>
          </View>

          <View style={styles.grid}>
            {sensorCards.map(card => (
              <SensorCard key={card.label} {...card} />
            ))}
          </View>
        </RevealView>
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
    paddingBottom: 136,
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: 16,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 24},
    shadowOpacity: 0.2,
    shadowRadius: 34,
    elevation: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStatusText: {
    color: COLORS.TEXT,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
  heroTitle: {
    marginTop: 10,
    color: COLORS.TEXT,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    fontFamily: FONTS.heading,
  },
  heroCopy: {
    marginTop: 10,
    color: COLORS.TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.body,
  },
  heroSignalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  heroSignalBubble: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroSignalGlow: {
    position: 'absolute',
    width: '84%',
    height: '84%',
    borderRadius: 999,
  },
  heroSignalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroSignalLabel: {
    color: COLORS.MUTED2,
    fontSize: 11,
    marginBottom: 4,
    fontFamily: FONTS.body,
  },
  heroSignalValue: {
    color: COLORS.TEXT,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  heroActionRow: {
    marginTop: 20,
  },
  armButton: {
    width: '100%',
    marginBottom: 12,
  },
  armButtonGradient: {
    minHeight: 64,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  armIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  armButtonCopy: {
    flex: 1,
  },
  armButtonLabel: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: FONTS.strong,
  },
  armButtonHint: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONTS.body,
  },
  simulateButtonWrap: {
    width: '100%',
  },
  simulateButtonTouch: {
    width: '100%',
  },
  simulateButton: {
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 16},
    shadowOpacity: 0.36,
    shadowRadius: 22,
    elevation: 10,
  },
  simulateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
    letterSpacing: 0.2,
    fontFamily: FONTS.strong,
  },
  rescueStrip: {
    marginTop: 20,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rescueStripIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 132, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rescueStripText: {
    flex: 1,
    color: COLORS.TEXT_DIM,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 25, 43, 0.88)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.22)',
    marginBottom: 20,
  },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  noticeText: {
    marginTop: 6,
    color: COLORS.MUTED2,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  sectionHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  sectionCaption: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONTS.body,
  },
  modeScroller: {
    paddingBottom: 8,
    paddingRight: 8,
  },
  modePill: {
    width: 196,
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modePillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  modePillActive: {
    backgroundColor: 'rgba(22, 36, 61, 0.96)',
    borderColor: 'rgba(89, 216, 255, 0.42)',
  },
  modeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCopy: {
    flex: 1,
    marginLeft: 12,
  },
  modeTitle: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  modeSubtitle: {
    marginTop: 4,
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quickCardReveal: {
    width: '48%',
  },
  quickCard: {
    width: '100%',
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(89, 216, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  quickTitle: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  quickSubtitle: {
    marginTop: 6,
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  readinessCard: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 18,
  },
  readinessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  readinessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  readinessIconActive: {
    backgroundColor: 'rgba(76, 242, 180, 0.12)',
  },
  readinessIconInactive: {
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
  },
  readinessLabel: {
    flex: 1,
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
  readinessValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
