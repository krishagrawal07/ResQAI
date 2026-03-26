import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {COLORS} from '../utils/constants';

const SECTIONS = [
  {
    key: 'detect',
    color: COLORS.CYAN,
    icon: 'scan-circle-outline',
    title: 'DETECT',
    subtitle: 'Sensor fusion and edge inference',
    features: [
      'Accelerometer Matrix',
      'Gyroscope Tracking',
      'Acoustic Audio AI',
      'Edge Processing',
    ],
  },
  {
    key: 'confirm',
    color: COLORS.PINK,
    icon: 'pulse-outline',
    title: 'CONFIRM',
    subtitle: 'False alarm containment layer',
    features: [
      'SOS Confirmation Loop',
      'No Response Assumption',
      'Automated Dispatch Trigger',
      'False Alarm Prevention',
    ],
  },
  {
    key: 'rescue',
    color: COLORS.GREEN,
    icon: 'shield-checkmark-outline',
    title: 'RESCUE',
    subtitle: 'Live location and responders',
    features: [
      'Live GPS Dispatch',
      'Police Station Alert',
      'Ground-Zero Local Aid',
      'Offline SMS Failsafe',
    ],
  },
];

function ExpandableCard({section, expanded, onToggle}) {
  const animatedHeight = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [animatedHeight, expanded]);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onToggle}
        style={styles.header}>
        <View
          style={[styles.iconCircle, {backgroundColor: `${section.color}18`}]}>
          <Ionicons color={section.color} name={section.icon} size={20} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.cardTitle}>{section.title}</Text>
          <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
        </View>
        <Ionicons
          color={section.color}
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
        />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.body,
          {
            maxHeight: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 300],
            }),
            opacity: animatedHeight,
          },
        ]}>
        {section.features.map(feature => (
          <View key={feature} style={styles.featureRow}>
            <View
              style={[styles.featureDot, {backgroundColor: section.color}]}
            />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export default function HowItWorksScreen() {
  const [expandedKey, setExpandedKey] = useState('detect');

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      {SECTIONS.map(section => (
        <ExpandableCard
          expanded={expandedKey === section.key}
          key={section.key}
          onToggle={() =>
            setExpandedKey(current =>
              current === section.key ? '' : section.key,
            )
          }
          section={section}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.08)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerCopy: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  featureText: {
    color: COLORS.TEXT,
    fontSize: 14,
  },
});
