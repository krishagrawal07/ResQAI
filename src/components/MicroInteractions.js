import React, {useEffect} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {COLORS} from '../utils/constants';
import NotificationService from '../services/NotificationService';

export function RipplePressable({
  children,
  contentStyle,
  disabled = false,
  haptic = 'light',
  onPress,
  onPressIn,
  onPressOut,
  rippleColor = 'rgba(255,255,255,0.26)',
  style,
}) {
  const pressed = useSharedValue(0);
  const ripple = useSharedValue(0);

  const handlePressIn = event => {
    if (!disabled) {
      NotificationService.hapticImpact(haptic);
      pressed.value = withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
      });
      ripple.value = 0;
      ripple.value = withTiming(1, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      });
    }

    onPressIn?.(event);
  };

  const handlePressOut = event => {
    pressed.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
    onPressOut?.(event);
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.52 : 1,
    transform: [{scale: interpolate(pressed.value, [0, 1], [1, 0.982])}],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.32, 1], [0, 0.28, 0]),
    transform: [{scale: interpolate(ripple.value, [0, 1], [0.2, 2.7])}],
  }));

  return (
    <Animated.View style={[style, styles.pressableShell, containerStyle]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.pressable, contentStyle]}>
        <View pointerEvents="none" style={styles.rippleClip}>
          <Animated.View
            style={[
              styles.rippleCircle,
              {backgroundColor: rippleColor},
              rippleStyle,
            ]}
          />
        </View>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function SkeletonBlock({
  height = 18,
  width = '100%',
  borderRadius = 12,
  style,
}) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, {duration: 0}),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(shimmer);
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.08, 0.26, 0.08]),
    transform: [{translateX: interpolate(shimmer.value, [0, 1], [-90, 140])}],
  }));

  return (
    <View style={[styles.skeleton, {height, width, borderRadius}, style]}>
      <Animated.View style={[styles.skeletonShimmer, shimmerStyle]} />
    </View>
  );
}

export function LoadingSkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonBlock height={18} width="48%" />
      <SkeletonBlock height={12} width="78%" style={styles.skeletonGap} />
      <SkeletonBlock height={12} width="64%" style={styles.skeletonSmallGap} />
    </View>
  );
}

export function EmergencyGlowBorder({active, children, style}) {
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      glow.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    glow.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0.25, {
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(glow);
  }, [active, glow]);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glow.value, [0, 1], [0.12, 0.44]),
  }));

  return (
    <Animated.View style={[styles.glowBorder, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressableShell: {
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
  },
  rippleClip: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rippleCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  skeleton: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 82,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  skeletonCard: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(13, 13, 13, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  skeletonGap: {
    marginTop: 12,
  },
  skeletonSmallGap: {
    marginTop: 8,
  },
  glowBorder: {
    borderWidth: 1,
    borderRadius: 34,
    borderColor: 'rgba(255, 59, 48, 0.72)',
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 28,
    elevation: 14,
  },
});
