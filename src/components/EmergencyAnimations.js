import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {COLORS, FONTS} from '../utils/constants';

const RING_TICKS = Array.from({length: 52}, (_, index) => index);
const TICK_SIZE = 148;
const TICK_RADIUS = TICK_SIZE / 2;

export function ReanimatedStatusDot({
  active,
  activeColor = COLORS.SUCCESS,
  idleColor = COLORS.YELLOW,
  size = 9,
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, {
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(pulse);
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: active ? interpolate(pulse.value, [0, 1], [0.55, 1]) : 1,
    transform: [
      {scale: active ? interpolate(pulse.value, [0, 1], [0.92, 1.14]) : 1},
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.statusDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? activeColor : idleColor,
        },
        dotStyle,
      ]}
    />
  );
}

export function PulsingSafetyIndicator({isMonitoring}) {
  const pulse = useSharedValue(0);
  const core = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1800,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, {duration: 0}),
      ),
      -1,
      false,
    );
    core.value = withRepeat(
      withSequence(
        withTiming(1.025, {
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0.985, {
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(pulse);
      cancelAnimation(core);
    };
  }, [core, pulse]);

  const outerPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.4, 0]),
    transform: [{scale: interpolate(pulse.value, [0, 1], [0.82, 1.2])}],
  }));
  const innerPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.24, 0.08]),
    transform: [{scale: interpolate(pulse.value, [0, 1], [0.94, 1.06])}],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{scale: core.value}],
  }));

  return (
    <View style={styles.safetyStage}>
      <Animated.View style={[styles.safetyOuterPulse, outerPulseStyle]} />
      <Animated.View style={[styles.safetyInnerPulse, innerPulseStyle]} />
      <Animated.View style={[styles.safetyDialShell, coreStyle]}>
        <LinearGradient
          colors={[
            'rgba(255, 59, 48, 0.48)',
            'rgba(10, 132, 255, 0.2)',
            'rgba(255, 255, 255, 0.08)',
          ]}
          end={{x: 1, y: 1}}
          start={{x: 0, y: 0}}
          style={styles.safetyDial}>
          <View style={styles.safetyGlass}>
            <View style={styles.safetyBeaconRow}>
              <ReanimatedStatusDot active={isMonitoring} size={8} />
              <Text style={styles.safetyBeaconText}>
                {isMonitoring ? 'Live guard' : 'Standby guard'}
              </Text>
            </View>
            <Text style={styles.safetyLabel}>Monitoring</Text>
            <Text style={styles.safetyStatus}>You are safe</Text>
            <Text style={styles.safetyMeta}>
              AI sensors watch for impact, rotation, speed drop, and cabin
              noise.
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function RingTick({index, progress}) {
  const threshold = 1 - index / RING_TICKS.length;
  const tickStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [threshold - 0.04, threshold],
      [0.18, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {rotate: `${(360 / RING_TICKS.length) * index}deg`},
      {translateY: -TICK_RADIUS + 6},
      {
        scaleY: interpolate(
          progress.value,
          [0, 1],
          [0.78, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return <Animated.View style={[styles.progressTick, tickStyle]} />;
}

export function CountdownProgressRing({active, countdown, duration = 10000}) {
  const progress = useSharedValue(1);
  const tickScale = useSharedValue(1);
  const tickOpacity = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      progress.value = 1;
      return undefined;
    }

    progress.value = 1;
    progress.value = withTiming(0, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });

    return () => cancelAnimation(progress);
  }, [active, duration, progress]);

  useEffect(() => {
    tickScale.value = 0.9;
    tickOpacity.value = 0.72;
    tickScale.value = withSpring(1, {
      damping: 13,
      stiffness: 150,
      mass: 0.8,
    });
    tickOpacity.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [countdown, tickOpacity, tickScale]);

  const numberStyle = useAnimatedStyle(() => ({
    opacity: tickOpacity.value,
    transform: [{scale: tickScale.value}],
  }));

  return (
    <View style={styles.countdownRing}>
      {RING_TICKS.map(index => (
        <RingTick index={index} key={index} progress={progress} />
      ))}
      <View style={styles.countdownInner}>
        <Text style={styles.countdownLabel}>Sending alert in</Text>
        <Animated.Text style={[styles.countdownNumber, numberStyle]}>
          {countdown}
        </Animated.Text>
        <Text style={styles.countdownUnit}>seconds</Text>
      </View>
    </View>
  );
}

export function AnimatedSuccessCheckmark({active, size = 116}) {
  const ring = useSharedValue(0);
  const core = useSharedValue(0.82);
  const shortLine = useSharedValue(0);
  const longLine = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    core.value = withSpring(1, {
      damping: 9,
      stiffness: 125,
      mass: 0.85,
    });
    shortLine.value = withDelay(
      170,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
    );
    longLine.value = withDelay(
      360,
      withTiming(1, {
        duration: 340,
        easing: Easing.out(Easing.cubic),
      }),
    );
    ring.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1300,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {duration: 0}),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(ring);
      cancelAnimation(core);
      cancelAnimation(shortLine);
      cancelAnimation(longLine);
    };
  }, [active, core, longLine, ring, shortLine]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.34, 0]),
    transform: [{scale: interpolate(ring.value, [0, 1], [0.82, 1.34])}],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{scale: core.value}],
  }));
  const shortLineStyle = useAnimatedStyle(() => ({
    opacity: shortLine.value,
    transform: [{rotate: '45deg'}, {scaleX: shortLine.value}],
  }));
  const longLineStyle = useAnimatedStyle(() => ({
    opacity: longLine.value,
    transform: [{rotate: '-45deg'}, {scaleX: longLine.value}],
  }));

  return (
    <Animated.View style={[styles.successShell, {width: size, height: size}]}>
      <Animated.View style={[styles.successPulse, ringStyle]} />
      <Animated.View style={[styles.successCore, coreStyle]}>
        <Animated.View style={[styles.checkShort, shortLineStyle]} />
        <Animated.View style={[styles.checkLong, longLineStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

export function FadeInWhen({active, children, delay = 0, style}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    if (!active) {
      opacity.value = 0;
      translateY.value = 10;
      return;
    }

    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [active, delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

export function PulsingLocationMarker({
  color = COLORS.PRIMARY,
  coreColor = COLORS.PRIMARY,
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, {duration: 0}),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.62, 0]),
    transform: [{scale: interpolate(pulse.value, [0, 1], [0.78, 2.05])}],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{scale: interpolate(pulse.value, [0, 1], [1, 1.12])}],
  }));

  return (
    <View style={styles.locationMarker}>
      <Animated.View
        style={[
          styles.locationMarkerPulse,
          {backgroundColor: color},
          pulseStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.locationMarkerCore,
          {backgroundColor: coreColor},
          coreStyle,
        ]}
      />
    </View>
  );
}

export function MapZoomShell({children, triggerKey}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.965);

  useEffect(() => {
    opacity.value = 0;
    scale.value = 0.965;
    opacity.value = withTiming(1, {
      duration: 560,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, scale, triggerKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: scale.value}],
  }));

  return (
    <Animated.View style={[styles.mapZoomShell, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statusDot: {
    marginRight: 8,
  },
  safetyStage: {
    height: 290,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  safetyOuterPulse: {
    position: 'absolute',
    width: 268,
    height: 268,
    borderRadius: 134,
    backgroundColor: COLORS.PRIMARY,
  },
  safetyInnerPulse: {
    position: 'absolute',
    width: 222,
    height: 222,
    borderRadius: 111,
    backgroundColor: COLORS.ACCENT,
  },
  safetyDialShell: {
    width: 236,
    height: 236,
    borderRadius: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyDial: {
    width: '100%',
    height: '100%',
    borderRadius: 118,
    padding: 1,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 22},
    shadowOpacity: 0.32,
    shadowRadius: 38,
    elevation: 16,
  },
  safetyGlass: {
    flex: 1,
    borderRadius: 117,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(13, 13, 13, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  safetyBeaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
  },
  safetyBeaconText: {
    color: COLORS.TEXT_DIM,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FONTS.strong,
  },
  safetyLabel: {
    color: COLORS.TEXT,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontFamily: FONTS.heading,
  },
  safetyStatus: {
    color: COLORS.SUCCESS,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
    fontFamily: FONTS.strong,
  },
  safetyMeta: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: FONTS.body,
  },
  countdownRing: {
    width: TICK_SIZE,
    height: TICK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  progressTick: {
    position: 'absolute',
    top: TICK_RADIUS - 3,
    left: TICK_RADIUS - 2,
    width: 4,
    height: 13,
    borderRadius: 2,
    backgroundColor: COLORS.PRIMARY,
  },
  countdownInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 13, 13, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  countdownLabel: {
    color: COLORS.MUTED2,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FONTS.strong,
  },
  countdownNumber: {
    color: COLORS.PRIMARY,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 58,
    fontFamily: FONTS.mono,
  },
  countdownUnit: {
    color: COLORS.TEXT,
    fontSize: 11,
    fontWeight: '800',
    marginTop: -2,
    fontFamily: FONTS.strong,
  },
  successShell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successPulse: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.SUCCESS,
  },
  successCore: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: COLORS.SUCCESS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: COLORS.SUCCESS,
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  checkShort: {
    position: 'absolute',
    width: 24,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.BG,
    left: 23,
    top: 46,
  },
  checkLong: {
    position: 'absolute',
    width: 44,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.BG,
    left: 38,
    top: 39,
  },
  locationMarker: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationMarkerPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  locationMarkerCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.TEXT,
  },
  mapZoomShell: {
    flex: 1,
  },
});
