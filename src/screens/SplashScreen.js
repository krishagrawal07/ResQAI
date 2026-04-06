import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AuroraBackground from '../components/AuroraBackground';
import BrandMark from '../components/BrandMark';
import {COLORS, FONTS, STORAGE_KEYS} from '../utils/constants';

export default function SplashScreen({navigation}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const haloRotation = useRef(new Animated.Value(0)).current;
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

    const haloLoop = Animated.loop(
      Animated.timing(haloRotation, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulseLoop.start();
    haloLoop.start();

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
      haloLoop.stop();
      clearTimeout(timer);
    };
  }, [haloRotation, navigation, opacity, pulse, translate]);

  const haloSpin = haloRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#050816', '#0B1120', '#111B32']}
      style={styles.container}>
      <AuroraBackground variant="auth" />

      <Animated.View
        style={[
          styles.haloRing,
          {
            transform: [{rotate: haloSpin}],
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.22, 0.46],
            }),
          },
        ]}
      />

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
        <View style={styles.shineBar} />
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
  haloRing: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(89, 216, 255, 0.24)',
    borderTopColor: 'rgba(255, 209, 102, 0.45)',
    borderRightColor: 'rgba(255, 92, 138, 0.36)',
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
    fontFamily: FONTS.heading,
  },
  caption: {
    marginTop: 14,
    color: COLORS.MUTED2,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
    maxWidth: 300,
    fontFamily: FONTS.body,
  },
  shineBar: {
    marginTop: 22,
    width: 110,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(89, 216, 255, 0.58)',
  },
});
