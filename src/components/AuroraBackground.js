import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS} from '../utils/constants';

const PALETTES = {
  default: {
    one: 'rgba(255, 59, 48, 0.24)',
    two: 'rgba(10, 132, 255, 0.18)',
    three: 'rgba(52, 199, 89, 0.1)',
  },
  monitor: {
    one: 'rgba(255, 59, 48, 0.28)',
    two: 'rgba(10, 132, 255, 0.22)',
    three: 'rgba(52, 199, 89, 0.14)',
  },
  dispatch: {
    one: 'rgba(255, 59, 48, 0.32)',
    two: 'rgba(10, 132, 255, 0.18)',
    three: 'rgba(255, 159, 10, 0.14)',
  },
  safety: {
    one: 'rgba(255, 214, 10, 0.18)',
    two: 'rgba(10, 132, 255, 0.18)',
    three: 'rgba(52, 199, 89, 0.14)',
  },
  insights: {
    one: 'rgba(10, 132, 255, 0.24)',
    two: 'rgba(255, 59, 48, 0.14)',
    three: 'rgba(52, 199, 89, 0.12)',
  },
  profile: {
    one: 'rgba(52, 199, 89, 0.18)',
    two: 'rgba(10, 132, 255, 0.2)',
    three: 'rgba(255, 59, 48, 0.12)',
  },
  auth: {
    one: 'rgba(10, 132, 255, 0.24)',
    two: 'rgba(255, 59, 48, 0.18)',
    three: 'rgba(255, 214, 10, 0.1)',
  },
};

function loopFloat(value, duration) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  );
}

export default function AuroraBackground({variant = 'default'}) {
  const tone = PALETTES[variant] ?? PALETTES.default;
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const driftC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = loopFloat(driftA, 8400);
    const loopB = loopFloat(driftB, 9700);
    const loopC = loopFloat(driftC, 7600);

    loopA.start();
    loopB.start();
    loopC.start();

    return () => {
      loopA.stop();
      loopB.stop();
      loopC.stop();
    };
  }, [driftA, driftB, driftC]);

  const blobTransforms = useMemo(
    () => ({
      one: {
        transform: [
          {
            translateX: driftA.interpolate({
              inputRange: [0, 1],
              outputRange: [-26, 24],
            }),
          },
          {
            translateY: driftA.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 18],
            }),
          },
          {
            scale: driftA.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.08],
            }),
          },
        ],
      },
      two: {
        transform: [
          {
            translateX: driftB.interpolate({
              inputRange: [0, 1],
              outputRange: [20, -24],
            }),
          },
          {
            translateY: driftB.interpolate({
              inputRange: [0, 1],
              outputRange: [-18, 22],
            }),
          },
          {
            scale: driftB.interpolate({
              inputRange: [0, 1],
              outputRange: [1.02, 0.94],
            }),
          },
        ],
      },
      three: {
        transform: [
          {
            translateX: driftC.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 16],
            }),
          },
          {
            translateY: driftC.interpolate({
              inputRange: [0, 1],
              outputRange: [20, -16],
            }),
          },
          {
            scale: driftC.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1.08],
            }),
          },
        ],
      },
    }),
    [driftA, driftB, driftC],
  );

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View style={[styles.blob, styles.blobOne, blobTransforms.one]}>
        <LinearGradient
          colors={[tone.one, 'rgba(0, 0, 0, 0)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobTwo, blobTransforms.two]}>
        <LinearGradient
          colors={[tone.two, 'rgba(0, 0, 0, 0)']}
          start={{x: 1, y: 0}}
          end={{x: 0, y: 1}}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View
        style={[styles.blob, styles.blobThree, blobTransforms.three]}>
        <LinearGradient
          colors={[tone.three, 'rgba(0, 0, 0, 0)']}
          start={{x: 0.5, y: 0}}
          end={{x: 0.5, y: 1}}
          style={styles.fill}
        />
      </Animated.View>

      <LinearGradient
        colors={['rgba(13, 13, 13, 0.5)', 'rgba(13, 13, 13, 0.16)', COLORS.BG]}
        locations={[0, 0.45, 1]}
        style={styles.vignette}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  blobOne: {
    width: 320,
    height: 320,
    top: -120,
    left: -120,
  },
  blobTwo: {
    width: 280,
    height: 280,
    top: -80,
    right: -110,
  },
  blobThree: {
    width: 340,
    height: 340,
    bottom: -170,
    left: -70,
  },
  fill: {
    flex: 1,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
});
