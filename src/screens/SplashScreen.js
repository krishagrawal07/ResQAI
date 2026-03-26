import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {COLORS, STORAGE_KEYS} from '../utils/constants';

const LETTERS = ['R', 'E', 'S', 'Q', 'A', 'I'];

export default function SplashScreen({navigation}) {
  const ringPulse = useRef(new Animated.Value(0)).current;
  const letterAnimations = useRef(
    LETTERS.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    ringLoop.start();

    Animated.stagger(
      120,
      letterAnimations.map(animation =>
        Animated.timing(animation, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start();

    const timer = setTimeout(async () => {
      const onboarded = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED);
      navigation.replace(onboarded === 'true' ? 'Login' : 'Onboarding');
    }, 2500);

    return () => {
      ringLoop.stop();
      clearTimeout(timer);
    };
  }, [letterAnimations, navigation, ringPulse]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.25, 0.7],
            }),
            transform: [
              {
                scale: ringPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1.15],
                }),
              },
            ],
          },
        ]}
      />

      <View style={styles.logoRow}>
        {LETTERS.map((letter, index) => (
          <Animated.Text
            key={letter}
            style={[
              styles.logoLetter,
              letter === 'Q' ? styles.logoAccent : null,
              {
                opacity: letterAnimations[index],
                transform: [
                  {
                    translateY: letterAnimations[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}>
            {letter}
          </Animated.Text>
        ))}
      </View>

      <Text style={styles.subtitle}>AUTONOMOUS ACCIDENT RESPONSE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.45)',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.CYAN,
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  logoAccent: {
    color: COLORS.PINK,
  },
  subtitle: {
    marginTop: 18,
    color: COLORS.MUTED,
    fontSize: 12,
    letterSpacing: 4,
  },
});
