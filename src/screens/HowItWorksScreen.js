import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AuroraBackground from '../components/AuroraBackground';
import RevealView from '../components/RevealView';
import {useAppContext} from '../context/AppContext';
import {COLORS, FONTS, MODE_META} from '../utils/constants';
import {formatSensorSource} from '../utils/helpers';

const PIPELINE = [
  {
    key: 'detect',
    color: COLORS.CYAN,
    icon: 'scan-outline',
    title: 'Detect',
    subtitle:
      'Sensor fusion watches motion, rotation, speed, and audio together.',
  },
  {
    key: 'verify',
    color: COLORS.YELLOW,
    icon: 'timer-outline',
    title: 'Verify',
    subtitle:
      'A cancellation window reduces false alarms without adding much delay.',
  },
  {
    key: 'dispatch',
    color: COLORS.PINK,
    icon: 'paper-plane-outline',
    title: 'Dispatch',
    subtitle:
      'Contacts, local support points, and rescue actions cascade automatically.',
  },
];

export default function HowItWorksScreen() {
  const {
    state: {dispatchLog, isMonitoring, mode, runtime, userProfile},
  } = useAppContext();

  const liveInsights = useMemo(
    () => [
      {
        key: 'profile',
        label: 'Active profile',
        value: MODE_META[mode]?.label ?? 'Bike',
      },
      {
        key: 'state',
        label: 'Protection state',
        value: isMonitoring ? 'Armed' : 'Standby',
      },
      {
        key: 'feed',
        label: 'Sensor feed',
        value: formatSensorSource(runtime.sensorSource),
      },
      {
        key: 'contact',
        label: 'Primary contact',
        value: userProfile.emergencyContact?.name || 'Not added yet',
      },
    ],
    [isMonitoring, mode, runtime.sensorSource, userProfile.emergencyContact],
  );

  const timeline = [
    {
      key: 'standby',
      icon: 'shield-checkmark-outline',
      title: isMonitoring ? 'Protection is armed' : 'Protection is standing by',
      subtitle: isMonitoring
        ? 'Your selected vehicle profile is actively watching the telemetry feed.'
        : 'Open Protect and arm the monitor when you are ready to travel.',
      accent: isMonitoring ? COLORS.GREEN : COLORS.YELLOW,
    },
    {
      key: 'preview',
      icon: 'pulse-outline',
      title:
        runtime.sensorSource === 'preview'
          ? 'Preview feed is keeping the UI alive'
          : 'Live feed is flowing from the device',
      subtitle:
        runtime.sensorSource === 'preview'
          ? 'This helps the app feel complete on simulators or when permissions are missing.'
          : 'Your sensors are delivering real updates for the crash model.',
      accent: runtime.sensorSource === 'preview' ? COLORS.YELLOW : COLORS.CYAN,
    },
    {
      key: 'dispatch',
      icon: 'navigate-outline',
      title:
        dispatchLog.length > 0
          ? `${dispatchLog.length} response lanes are active`
          : 'No active dispatch lanes yet',
      subtitle:
        dispatchLog.length > 0
          ? 'Open Rescue to inspect the live map, timelines, and ETA cards.'
          : 'Run a rescue drill to preview contacts, landmarks, and responders.',
      accent: dispatchLog.length > 0 ? COLORS.PINK : COLORS.MUTED2,
    },
  ];

  return (
    <View style={styles.container}>
      <AuroraBackground variant="insights" />

      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.scrollBody}>
        <RevealView delay={40}>
          <LinearGradient
            colors={['rgba(16, 25, 43, 0.95)', 'rgba(22, 36, 61, 0.8)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.hero}>
            <View style={styles.heroBadge}>
              <Ionicons
                color={COLORS.CYAN}
                name="analytics-outline"
                size={18}
              />
              <Text style={styles.heroBadgeText}>Product insights</Text>
            </View>
            <Text style={styles.heroTitle}>
              Why this feels like a real app now
            </Text>
            <Text style={styles.heroCopy}>
              The experience is no longer just a sensor mockup. It now carries a
              proper safety flow, profile system, response desk, configurable
              rescue settings, and a preview mode that prevents dead screens.
            </Text>
          </LinearGradient>
        </RevealView>

        <RevealView delay={100}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Response pipeline</Text>
            <Text style={styles.sectionCaption}>
              The three layers of the rescue journey
            </Text>
          </View>

          {PIPELINE.map(item => (
            <View key={item.key} style={styles.pipelineCard}>
              <View
                style={[
                  styles.pipelineIconWrap,
                  {backgroundColor: `${item.color}18`},
                ]}>
                <Ionicons color={item.color} name={item.icon} size={22} />
              </View>
              <View style={styles.pipelineCopy}>
                <Text style={styles.pipelineTitle}>{item.title}</Text>
                <Text style={styles.pipelineSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
        </RevealView>

        <RevealView delay={170}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live insights</Text>
            <Text style={styles.sectionCaption}>
              Signals from your current app state
            </Text>
          </View>

          <View style={styles.insightGrid}>
            {liveInsights.map(item => (
              <View key={item.key} style={styles.insightCard}>
                <Text style={styles.insightLabel}>{item.label}</Text>
                <Text style={styles.insightValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </RevealView>

        <RevealView delay={240}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Operational timeline</Text>
            <Text style={styles.sectionCaption}>
              A quick read on what the system is doing right now
            </Text>
          </View>

          <View style={styles.timelineCard}>
            {timeline.map(item => (
              <View key={item.key} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineIcon,
                    {backgroundColor: `${item.accent}18`},
                  ]}>
                  <Ionicons color={item.accent} name={item.icon} size={18} />
                </View>
                <View style={styles.timelineCopy}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        </RevealView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  content: {
    padding: 16,
    paddingBottom: 136,
  },
  scrollBody: {
    flex: 1,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.24)',
    marginBottom: 18,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: COLORS.TEXT,
    fontWeight: '700',
    marginLeft: 8,
    fontFamily: FONTS.strong,
  },
  heroTitle: {
    marginTop: 22,
    color: COLORS.TEXT,
    fontSize: 27,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  heroCopy: {
    marginTop: 10,
    color: COLORS.TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.body,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  sectionCaption: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONTS.body,
  },
  pipelineCard: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pipelineIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pipelineCopy: {
    flex: 1,
  },
  pipelineTitle: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  pipelineSubtitle: {
    color: COLORS.MUTED2,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontFamily: FONTS.body,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  insightCard: {
    width: '48%',
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  insightLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    fontFamily: FONTS.body,
  },
  insightValue: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    fontFamily: FONTS.strong,
  },
  timelineCard: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineCopy: {
    flex: 1,
  },
  timelineTitle: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  timelineSubtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontFamily: FONTS.body,
  },
});
