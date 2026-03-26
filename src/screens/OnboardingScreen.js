import React, {useRef, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {COLORS, STORAGE_KEYS} from '../utils/constants';

const PAGES = [
  {
    icon: '🛰️',
    title: 'ALWAYS WATCHING',
    body: 'ResQ AI monitors your accelerometer, gyroscope and microphone 24/7 — even when your screen is off.',
  },
  {
    icon: '⚡',
    title: 'MILLISECOND RESPONSE',
    body: 'The moment a crash is detected, a 10-second confirmation window opens. No response = SOS fired.',
  },
  {
    icon: '🚨',
    title: 'AUTOMATED RESCUE',
    body: 'Police, nearby aid, and your emergency contact are alerted instantly with your live GPS location.',
  },
];

export default function OnboardingScreen({navigation}) {
  const {width} = useWindowDimensions();
  const listRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScrollEnd = event => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        keyExtractor={item => item.title}
        pagingEnabled
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({item}) => (
          <View style={[styles.page, {width}]}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
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
              ]}
            />
          ))}
        </View>

        {activeIndex === PAGES.length - 1 ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleGetStarted}
            style={styles.button}>
            <Text style={styles.buttonText}>GET STARTED</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              const nextIndex = Math.min(activeIndex + 1, PAGES.length - 1);
              listRef.current?.scrollToIndex({
                animated: true,
                index: nextIndex,
              });
              setActiveIndex(nextIndex);
            }}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>NEXT</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  icon: {
    fontSize: 72,
    marginBottom: 22,
  },
  title: {
    color: COLORS.CYAN,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  body: {
    marginTop: 16,
    color: COLORS.MUTED2,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
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
    backgroundColor: 'rgba(123,133,168,0.35)',
    marginHorizontal: 6,
  },
  dotActive: {
    backgroundColor: COLORS.CYAN,
    width: 22,
  },
  button: {
    backgroundColor: COLORS.PINK,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: COLORS.MUTED2,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
