import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {COLORS} from '../utils/constants';

function DispatchLogItem({item}) {
  const translateX = useRef(new Animated.Value(-30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 250,
        delay: 600,
        useNativeDriver: true,
      }).start();
    });
  }, [checkOpacity, opacity, translateX]);

  return (
    <Animated.View
      style={[
        styles.item,
        {
          opacity,
          transform: [{translateX}],
        },
      ]}>
      <View
        style={[
          styles.icon,
          {backgroundColor: `${item.color}18`, borderColor: item.color},
        ]}>
        <View style={[styles.dot, {backgroundColor: item.color}]} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <Text style={[styles.eta, {color: item.color}]}>{item.eta}</Text>
      </View>
      <Animated.Text style={[styles.check, {opacity: checkOpacity}]}>
        ✓
      </Animated.Text>
    </Animated.View>
  );
}

export default function DispatchLog({items = []}) {
  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <Text style={styles.empty}>
          Dispatch events will appear here after SOS activation.
        </Text>
      ) : (
        items.map(item => <DispatchLogItem item={item} key={item.id} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  empty: {
    color: COLORS.MUTED2,
    fontSize: 13,
    paddingVertical: 8,
  },
  item: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.08)',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
  },
  eta: {
    marginTop: 6,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
  },
  check: {
    color: COLORS.GREEN,
    fontSize: 20,
    fontWeight: '800',
  },
});
