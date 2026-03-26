import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {COLORS} from '../utils/constants';

const TYPE_ICONS = {
  contact: 'call-outline',
  landmark: 'location-outline',
  medical: 'medkit-outline',
  police: 'shield-outline',
};

function DispatchLogItem({item}) {
  const translateY = useRef(new Animated.Value(16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.item,
        {
          opacity,
          transform: [{translateY}],
        },
      ]}>
      <View
        style={[
          styles.icon,
          {backgroundColor: `${item.color}18`, borderColor: `${item.color}55`},
        ]}>
        <Ionicons
          color={item.color}
          name={TYPE_ICONS[item.type] ?? 'radio-outline'}
          size={18}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <Text style={[styles.eta, {color: item.color}]}>{item.eta}</Text>
      </View>
      <Ionicons color={COLORS.GREEN} name="checkmark-circle" size={20} />
    </Animated.View>
  );
}

export default function DispatchLog({items = []}) {
  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            color={COLORS.MUTED2}
            name="time-outline"
            size={18}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No live dispatches yet</Text>
          <Text style={styles.empty}>
            Trigger a rescue drill or a real SOS and the response lanes will
            appear here.
          </Text>
        </View>
      ) : (
        items.map(item => <DispatchLogItem item={item} key={item.id} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 18,
  },
  emptyCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyIcon: {
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  empty: {
    color: COLORS.MUTED2,
    fontSize: 13,
    lineHeight: 20,
  },
  item: {
    backgroundColor: COLORS.CARD,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  eta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
  },
});
