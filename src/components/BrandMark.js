import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {COLORS, FONTS} from '../utils/constants';

export default function BrandMark({
  size = 56,
  showWordmark = false,
  title = 'ResQ AI',
  subtitle = 'Predict. Protect. Dispatch.',
}) {
  const orbSize = size;
  const iconSize = Math.max(18, size * 0.42);

  return (
    <View style={styles.row}>
      <View style={[styles.shell, {width: orbSize + 14, height: orbSize + 14}]}>
        <View
          style={[
            styles.glow,
            {
              width: orbSize + 14,
              height: orbSize + 14,
              borderRadius: (orbSize + 14) / 2,
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              width: orbSize + 4,
              height: orbSize + 4,
              borderRadius: (orbSize + 4) / 2,
            },
          ]}
        />
        <LinearGradient
          colors={[COLORS.CYAN, COLORS.BLUE, COLORS.PINK]}
          end={{x: 1, y: 1}}
          start={{x: 0, y: 0}}
          style={[
            styles.orb,
            {
              width: orbSize,
              height: orbSize,
              borderRadius: orbSize / 2,
            },
          ]}>
          <View style={styles.orbInner}>
            <View style={styles.coreDot} />
            <Ionicons color={COLORS.TEXT} name="radio" size={iconSize - 2} />
          </View>
        </LinearGradient>
      </View>

      {showWordmark ? (
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(89, 216, 255, 0.18)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.CYAN,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
  },
  orbInner: {
    width: '76%',
    height: '76%',
    borderRadius: 999,
    backgroundColor: 'rgba(8,12,20,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  copy: {
    marginLeft: 14,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: FONTS.heading,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.MUTED2,
    fontSize: 12,
    fontFamily: FONTS.body,
  },
});
