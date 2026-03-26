import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import BrandMark from '../components/BrandMark';
import {COLORS, STORAGE_KEYS} from '../utils/constants';

export default function SplashScreen({navigation}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(async () => {
      const [onboarded, savedProfile] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED),
        AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE),
      ]);

      const hasProfile = Boolean(savedProfile);

      if (onboarded !== 'true') {
        navigation.replace('Onboarding');
        return;
      }

      navigation.replace(hasProfile ? 'MainTabs' : 'Login');
    }, 2100);

    return () => {
      pulseLoop.stop();
      clearTimeout(timer);
    };
  }, [navigation, opacity, pulse, translate]);

  return (
    <LinearGradient
      colors={['#050816', '#0B1120', '#111B32']}
      style={styles.container}>
      <Animated.View
        style={[
          styles.backdropOrb,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.22, 0.58],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1.14],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {opacity, transform: [{translateY: translate}]},
        ]}>
        <BrandMark
          showWordmark
          size={82}
          subtitle="Accident intelligence with real rescue follow-through"
          title="ResQ AI"
        />
        <Text style={styles.heading}>Protection that feels like a product</Text>
        <Text style={styles.caption}>
          Live safety monitoring, smarter rescue drills, and emergency response
          tools in one place.
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  backdropOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(89, 216, 255, 0.16)',
  },
  content: {
    alignItems: 'center',
  },
  heading: {
    marginTop: 26,
    color: COLORS.TEXT,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  caption: {
    marginTop: 14,
    color: COLORS.MUTED2,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
    maxWidth: 300,
  },
});
