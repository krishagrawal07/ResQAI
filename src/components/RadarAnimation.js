import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS} from '../utils/constants';

export default function RadarAnimation() {
  const outerRotation = useRef(new Animated.Value(0)).current;
  const middleRotation = useRef(new Animated.Value(0)).current;
  const corePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const outerLoop = Animated.loop(
      Animated.timing(outerRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const middleLoop = Animated.loop(
      Animated.timing(middleRotation, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const coreLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(corePulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(corePulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    outerLoop.start();
    middleLoop.start();
    coreLoop.start();

    return () => {
      outerLoop.stop();
      middleLoop.stop();
      coreLoop.stop();
    };
  }, [corePulse, middleRotation, outerRotation]);

  const outerSpin = outerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const middleSpin = middleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const coreScale = corePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const coreOpacity = corePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.ring,
          styles.outerRing,
          {transform: [{rotate: outerSpin}]},
        ]}>
        <Animated.View
          style={[styles.sweepContainer, {transform: [{rotate: outerSpin}]}]}>
          <LinearGradient
            colors={['rgba(0,229,255,0.95)', 'rgba(0,229,255,0)']}
            locations={[0, 1]}
            start={{x: 0.5, y: 1}}
            end={{x: 0.5, y: 0}}
            style={styles.sweepLine}
          />
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={[
          styles.ring,
          styles.middleRing,
          {transform: [{rotate: middleSpin}]},
        ]}
      />
      <View style={styles.innerRing}>
        <Animated.View
          style={[
            styles.core,
            {
              opacity: coreOpacity,
              transform: [{scale: coreScale}],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 180,
    height: 180,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.15)',
  },
  middleRing: {
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
  },
  innerRing: {
    width: 64,
    height: 64,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 16,
    height: 16,
    borderRadius: 16,
    backgroundColor: COLORS.CYAN,
    shadowColor: COLORS.CYAN,
    shadowOpacity: 0.8,
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 12,
    elevation: 8,
  },
  sweepContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sweepLine: {
    width: 3,
    height: 90,
    borderRadius: 3,
  },
});
