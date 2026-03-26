import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {COLORS} from '../utils/constants';

export default function SensorCard({label, value, unit, color, percentage}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: percentage,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [percentage, progress]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [0, trackWidth || 1],
  });

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, {color}]}>{Number(value).toFixed(2)}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
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
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.MUTED,
    width: '48%',
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    color: COLORS.MUTED2,
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  unit: {
    fontSize: 10,
    color: COLORS.MUTED2,
    marginLeft: 4,
    marginBottom: 3,
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 2,
  },
});
