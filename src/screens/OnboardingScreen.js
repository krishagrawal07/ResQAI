import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AuroraBackground from '../components/AuroraBackground';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BrandMark from '../components/BrandMark';
import RevealView from '../components/RevealView';
import {COLORS, FONTS, STORAGE_KEYS} from '../utils/constants';

const PAGES = [
  {
    icon: 'pulse-outline',
    title: 'Protection that stays alive',
    body: 'Live telemetry when the device is ready, and smart preview data when you are testing on a simulator or missing permissions.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Real rescue flow',
    body: 'A crash drill now fans out to a rescue desk, map, dispatch timeline, and emergency contact cascade instead of stopping at one mock screen.',
  },
  {
    icon: 'options-outline',
    title: 'More control',
    body: 'You get dedicated Safety, Insights, and Profile areas for tuning detection, reviewing response behavior, and storing rescue details.',
  },
];

export default function OnboardingScreen({navigation}) {
  const {width} = useWindowDimensions();
  const listRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 820,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulse]);

  const handleScrollEnd = event => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    navigation.replace('Login');
  };

  return (
    <LinearGradient
      colors={['#050816', '#0B1120', '#111B32']}
      style={styles.container}>
      <AuroraBackground variant="auth" />

      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        keyExtractor={item => item.title}
        pagingEnabled
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({item}) => (
          <View style={[styles.page, {width}]}>
            <RevealView delay={80} style={styles.pageCard}>
              <BrandMark size={76} />
              <View style={styles.iconWrap}>
                <Ionicons color={COLORS.CYAN} name={item.icon} size={34} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </RevealView>
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {PAGES.map((page, index) => (
            <View
              key={page.title}
              style={[
                styles.dot,
                activeIndex === index ? styles.dotActive : null,
              ]}>
              {activeIndex === index ? (
                <Animated.View
                  style={[
                    styles.dotPulse,
                    {
                      opacity: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 0.12],
                      }),
                      transform: [
                        {
                          scale: pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.7],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>

        {activeIndex === PAGES.length - 1 ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleGetStarted}
            style={styles.button}>
            <Text style={styles.buttonText}>Continue to setup</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => {
              const nextIndex = Math.min(activeIndex + 1, PAGES.length - 1);
              listRef.current?.scrollToIndex({
                animated: true,
                index: nextIndex,
              });
              setActiveIndex(nextIndex);
            }}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  pageCard: {
    width: '100%',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.22)',
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(18, 31, 50, 0.58)',
  },
  iconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(89, 216, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 22,
    fontFamily: FONTS.heading,
  },
  body: {
    marginTop: 16,
    color: COLORS.TEXT_DIM,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    fontFamily: FONTS.body,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(151, 166, 199, 0.35)',
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dotActive: {
    backgroundColor: COLORS.CYAN,
    width: 24,
  },
  dotPulse: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(89, 216, 255, 0.55)',
  },
  button: {
    backgroundColor: '#7BE8FF',
    borderRadius: 18,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.BG,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: FONTS.strong,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 27, 50, 0.66)',
  },
  secondaryButtonText: {
    color: COLORS.TEXT,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
});
