import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {COLORS} from '../utils/constants';

export default function SensorCard({
  label,
  value,
  unit,
  color,
  percentage,
  icon = 'pulse-outline',
  hint = '',
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: percentage,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [percentage, progress]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [0, trackWidth || 1],
  });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, {backgroundColor: `${color}18`}]}>
          <Ionicons color={color} name={icon} size={18} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, {color}]}>{Number(value).toFixed(2)}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <View
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        style={styles.track}>
        <Animated.View
          style={[styles.fill, {backgroundColor: color, width: animatedWidth}]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: COLORS.CARD,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  label: {
    flex: 1,
    color: COLORS.TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 18,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  unit: {
    marginLeft: 6,
    marginBottom: 4,
    color: COLORS.MUTED2,
    fontSize: 11,
  },
  hint: {
    marginTop: 8,
    color: COLORS.MUTED2,
    fontSize: 11,
  },
  track: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: 999,
  },
});
