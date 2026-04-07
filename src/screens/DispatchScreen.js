import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AuroraBackground from '../components/AuroraBackground';
import DispatchLog from '../components/DispatchLog';
import {
  AnimatedSuccessCheckmark,
  FadeInWhen,
  ReanimatedStatusDot,
} from '../components/EmergencyAnimations';
import LiveMap from '../components/LiveMap';
import RevealView from '../components/RevealView';
import {useAppContext} from '../context/AppContext';
import BackendService from '../services/BackendService';
import DispatchService from '../services/DispatchService';
import LiveTrackingService from '../services/LiveTrackingService';
import {COLORS, FONTS} from '../utils/constants';
import {formatCoordinates} from '../utils/helpers';

export default function DispatchScreen({navigation}) {
  const {
    state: {
      activeIncident,
      crashMeta,
      dispatchLog,
      location,
      preferences,
      sosTriggered,
      userProfile,
    },
    dispatch,
  } = useAppContext();
  const [showDispatchedCard, setShowDispatchedCard] = useState(false);
  const expectedDispatchCount = useMemo(() => {
    let total = 0;
    if (preferences.notifyNearbyResponders) {
      total += 3;
    }
    if (preferences.guardianMode) {
      total += 1;
    }
    return Math.max(total, 1);
  }, [preferences.guardianMode, preferences.notifyNearbyResponders]);
  const allDispatched = dispatchLog.length >= expectedDispatchCount;
  const handleMapLocationUpdate = useCallback(
    nextLocation => {
      dispatch({type: 'SET_LOCATION', payload: nextLocation});
    },
    [dispatch],
  );

  useEffect(() => {
    let completionTimer;
    const completionDelay = Math.max(3200, expectedDispatchCount * 1700);

    if (
      sosTriggered &&
      location.lat &&
      location.lng &&
      dispatchLog.length === 0
    ) {
      DispatchService.startDispatchSequence({
        location,
        preferences,
        userProfile,
        onDispatch: entry => {
          dispatch({type: 'ADD_DISPATCH_LOG', payload: entry});
        },
      });
    }

    if (sosTriggered) {
      completionTimer = setTimeout(() => {
        setShowDispatchedCard(true);
      }, completionDelay);
    } else {
      setShowDispatchedCard(false);
    }

    return () => clearTimeout(completionTimer);
  }, [
    dispatch,
    dispatchLog.length,
    expectedDispatchCount,
    location,
    preferences,
    sosTriggered,
    userProfile,
  ]);

  const handleReset = async () => {
    DispatchService.stopDispatchSequence();
    await LiveTrackingService.stop();

    if (activeIncident?.id) {
      try {
        await BackendService.updateIncidentStatus(
          activeIncident.id,
          'resolved',
        );
      } catch (error) {
        console.log('Unable to update incident status', error);
      }
    }

    dispatch({type: 'RESET_CRASH'});
    navigation.navigate('Monitor');
  };

  const handleOpenTracking = async () => {
    const trackingUrl = activeIncident?.trackingUrl;
    if (!trackingUrl) {
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(trackingUrl);
      if (!canOpen) {
        Alert.alert('Link unavailable', 'Unable to open live tracking link.');
        return;
      }
      await Linking.openURL(trackingUrl);
    } catch (error) {
      Alert.alert('Open failed', 'Unable to open live tracking link.');
    }
  };

  const heroTone = !sosTriggered
    ? {
        badge: 'Response armed',
        copy: 'The rescue desk is ready. Run a rescue drill from Protect to preview the full flow.',
        accent: COLORS.CYAN,
      }
    : allDispatched
    ? {
        badge: 'Units dispatched',
        copy: 'Your emergency contact, responder points, and nearby support have all been engaged.',
        accent: COLORS.GREEN,
      }
    : {
        badge: 'Dispatch in progress',
        copy: 'Responder notifications are cascading. The map and response cards update as the network fans out.',
        accent: COLORS.PINK,
      };

  const responseCards = useMemo(
    () => [
      {
        key: 'cascade',
        label: 'Cascade',
        value: `${dispatchLog.length}/${expectedDispatchCount} live`,
      },
      {
        key: 'eta',
        label: 'Best ETA',
        value: allDispatched ? '4 min' : '2-4 min',
      },
      {
        key: 'severity',
        label: 'Severity',
        value:
          activeIncident?.severity?.label ||
          crashMeta?.severity?.label ||
          'Low',
      },
    ],
    [
      activeIncident?.severity?.label,
      allDispatched,
      crashMeta?.severity?.label,
      dispatchLog.length,
      expectedDispatchCount,
    ],
  );

  const dispatchSettings = useMemo(
    () => [
      {
        key: 'guardian',
        label: preferences.guardianMode ? 'Guardian on' : 'Guardian off',
        active: preferences.guardianMode,
      },
      {
        key: 'nearby',
        label: preferences.notifyNearbyResponders
          ? 'Nearby ping on'
          : 'Nearby ping off',
        active: preferences.notifyNearbyResponders,
      },
      {
        key: 'silent',
        label: preferences.silentDispatch ? 'Silent mode' : 'Audio mode',
        active: !preferences.silentDispatch,
      },
    ],
    [
      preferences.guardianMode,
      preferences.notifyNearbyResponders,
      preferences.silentDispatch,
    ],
  );

  const checklist = useMemo(() => {
    const items = [
      {
        key: 'gps',
        label: 'GPS pin confirmed',
        done: Boolean(location.lat && location.lng),
      },
    ];

    if (preferences.guardianMode) {
      items.push({
        key: 'contact',
        label: 'Emergency contact queued',
        done: dispatchLog.some(item => item.type === 'contact'),
      });
    } else {
      items.push({
        key: 'contact-disabled',
        label: 'Guardian mode is turned off',
        done: true,
      });
    }

    if (preferences.notifyNearbyResponders) {
      items.push(
        {
          key: 'police',
          label: 'Nearest authorities routed',
          done: dispatchLog.some(item => item.type === 'police'),
        },
        {
          key: 'ground',
          label: 'Ground support landmark added',
          done: dispatchLog.some(item => item.type === 'landmark'),
        },
      );
    } else {
      items.push({
        key: 'nearby-disabled',
        label: 'Nearby responder ping is turned off',
        done: true,
      });
    }

    return items;
  }, [
    dispatchLog,
    location.lat,
    location.lng,
    preferences.guardianMode,
    preferences.notifyNearbyResponders,
  ]);

  return (
    <View style={styles.container}>
      <AuroraBackground variant="dispatch" />

      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.scrollBody}>
        <RevealView delay={40}>
          <LinearGradient
            colors={['rgba(28, 28, 30, 0.95)', 'rgba(13, 13, 13, 0.86)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.hero}>
            <View style={styles.heroBadge}>
              <ReanimatedStatusDot
                active={sosTriggered && !allDispatched}
                activeColor={heroTone.accent}
                idleColor={heroTone.accent}
              />
              <Text style={[styles.heroBadgeText, {color: heroTone.accent}]}>
                {heroTone.badge}
              </Text>
            </View>

            {sosTriggered ? (
              <View style={styles.sentHero}>
                <AnimatedSuccessCheckmark active={sosTriggered} />
                <FadeInWhen active={sosTriggered} delay={240}>
                  <Text style={styles.sentTitle}>Help is on the way</Text>
                </FadeInWhen>
                <FadeInWhen active={sosTriggered} delay={380}>
                  <Text style={styles.sentCopy}>
                    Your emergency alert is live. ResQ AI is sharing your crash
                    context, location, and rescue preferences with the response
                    network.
                  </Text>
                </FadeInWhen>
              </View>
            ) : (
              <>
                <Text style={styles.heroTitle}>Rescue coordination desk</Text>
                <Text style={styles.heroCopy}>{heroTone.copy}</Text>
              </>
            )}

            <View style={styles.heroCardsRow}>
              {responseCards.map(card => (
                <View key={card.key} style={styles.heroMetricCard}>
                  <Text style={styles.heroMetricLabel}>{card.label}</Text>
                  <Text style={styles.heroMetricValue}>{card.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.heroOptionsRow}>
              {dispatchSettings.map(item => (
                <View
                  key={item.key}
                  style={[
                    styles.heroOptionPill,
                    item.active
                      ? styles.heroOptionPillActive
                      : styles.heroOptionPillMuted,
                  ]}>
                  <Text style={styles.heroOptionText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </RevealView>

        <RevealView delay={100}>
          <View style={styles.gpsCard}>
            <View style={styles.gpsTopRow}>
              <Text style={styles.cardTitle}>Incident pin</Text>
              <View style={styles.gpsBadge}>
                <Text style={styles.gpsBadgeText}>
                  {location.lat && location.lng ? 'Ready' : 'Preview'}
                </Text>
              </View>
            </View>
            <Text style={styles.coords}>
              {formatCoordinates(location.lat, location.lng)}
            </Text>
            <Text style={styles.address}>
              {location.address || 'Waiting for a confirmed street address'}
            </Text>
            {activeIncident?.trackingUrl ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleOpenTracking}
                style={styles.trackingRow}>
                <Ionicons color={COLORS.CYAN} name="link-outline" size={16} />
                <Text numberOfLines={1} style={styles.trackingText}>
                  {activeIncident.trackingUrl}
                </Text>
                <Text style={styles.trackingHint}>Open</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </RevealView>

        {activeIncident?.notifications?.length ? (
          <RevealView delay={140}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alert delivery</Text>
              <Text style={styles.sectionCaption}>
                Emergency contacts and hospitals notified
              </Text>
            </View>

            <View style={styles.checklistCard}>
              {activeIncident.notifications.map(item => {
                const queued = String(item.status).includes('queued');

                return (
                  <View
                    key={`${item.phone}-${item.name}`}
                    style={styles.checklistRow}>
                    <View
                      style={[
                        styles.checklistIcon,
                        queued
                          ? styles.checklistIconPending
                          : styles.checklistIconDone,
                      ]}>
                      <Ionicons
                        color={queued ? COLORS.YELLOW : COLORS.GREEN}
                        name={queued ? 'time-outline' : 'checkmark-circle'}
                        size={18}
                      />
                    </View>
                    <View style={styles.deliveryCopy}>
                      <Text style={styles.checklistLabel}>{item.name}</Text>
                      <Text style={styles.deliveryMeta}>
                        {item.type} - {item.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </RevealView>
        ) : null}

        <RevealView delay={160}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dispatch timeline</Text>
            <Text style={styles.sectionCaption}>
              Who is being engaged right now
            </Text>
          </View>
          <DispatchLog items={dispatchLog} />
        </RevealView>

        <RevealView delay={220}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {sosTriggered ? 'Map preview' : 'Rescue map'}
            </Text>
            <Text style={styles.sectionCaption}>
              {sosTriggered
                ? 'Your live location pin stays visible while help routes in'
                : 'Route lines update as support points get attached'}
            </Text>
          </View>
          <LiveMap
            dispatchLog={dispatchLog}
            location={location}
            onUserLocationChange={handleMapLocationUpdate}
            title={
              sosTriggered ? 'Emergency map preview' : 'Responder GPS handoff'
            }
          />
        </RevealView>

        <RevealView delay={280}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Response checklist</Text>
            <Text style={styles.sectionCaption}>
              Critical steps for an effective rescue handoff
            </Text>
          </View>

          <View style={styles.checklistCard}>
            {checklist.map(item => (
              <View key={item.key} style={styles.checklistRow}>
                <View
                  style={[
                    styles.checklistIcon,
                    item.done
                      ? styles.checklistIconDone
                      : styles.checklistIconPending,
                  ]}>
                  <Ionicons
                    color={item.done ? COLORS.GREEN : COLORS.YELLOW}
                    name={item.done ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                  />
                </View>
                <Text style={styles.checklistLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </RevealView>

        {showDispatchedCard && allDispatched ? (
          <RevealView delay={340}>
            <View style={styles.completedCard}>
              <Text style={styles.completedTitle}>
                All support lanes are active
              </Text>
              <Text style={styles.completedEta}>
                Best estimated arrival is about{' '}
                {expectedDispatchCount >= 4 ? '4' : '2'} minutes.
              </Text>
            </View>
          </RevealView>
        ) : null}

        <RevealView delay={390}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleReset}
            style={styles.resetButton}>
            <Ionicons color={COLORS.TEXT} name="arrow-back-outline" size={18} />
            <Text style={styles.resetButtonText}>Return to Protect</Text>
          </TouchableOpacity>
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
  scrollBody: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 136,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: 16,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 24},
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '800',
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
  sentHero: {
    alignItems: 'center',
    paddingTop: 20,
  },
  sentTitle: {
    color: COLORS.TEXT,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
    fontFamily: FONTS.heading,
  },
  sentCopy: {
    color: COLORS.TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: FONTS.body,
  },
  heroCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  heroMetricCard: {
    width: '31%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  heroMetricLabel: {
    color: COLORS.MUTED2,
    fontSize: 11,
    marginBottom: 6,
    fontFamily: FONTS.body,
  },
  heroMetricValue: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  heroOptionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heroOptionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  heroOptionPillActive: {
    backgroundColor: 'rgba(76, 242, 180, 0.12)',
    borderColor: 'rgba(76, 242, 180, 0.45)',
  },
  heroOptionPillMuted: {
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
    borderColor: 'rgba(255, 209, 102, 0.45)',
  },
  heroOptionText: {
    color: COLORS.TEXT,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
  gpsCard: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.22)',
  },
  gpsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  gpsBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(76, 242, 180, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gpsBadgeText: {
    color: COLORS.GREEN,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
  coords: {
    color: COLORS.CYAN,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    fontFamily: FONTS.mono,
  },
  address: {
    color: COLORS.MUTED2,
    marginTop: 10,
    lineHeight: 20,
    fontSize: 13,
    fontFamily: FONTS.body,
  },
  trackingRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(89, 216, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trackingText: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.CYAN,
    fontSize: 12,
    fontFamily: FONTS.body,
  },
  trackingHint: {
    marginLeft: 10,
    color: COLORS.TEXT,
    fontSize: 11,
    fontFamily: FONTS.strong,
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
  checklistCard: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginTop: 2,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checklistIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checklistIconDone: {
    backgroundColor: 'rgba(76, 242, 180, 0.12)',
  },
  checklistIconPending: {
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
  },
  checklistLabel: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
  deliveryCopy: {
    flex: 1,
  },
  deliveryMeta: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
    fontFamily: FONTS.body,
  },
  completedCard: {
    marginTop: 16,
    backgroundColor: 'rgba(76, 242, 180, 0.1)',
    borderColor: COLORS.GREEN,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  completedTitle: {
    color: COLORS.GREEN,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  completedEta: {
    color: COLORS.TEXT,
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONTS.body,
  },
  resetButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(22, 36, 61, 0.92)',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  resetButtonText: {
    color: COLORS.TEXT,
    fontWeight: '800',
    marginLeft: 8,
    fontFamily: FONTS.strong,
  },
});
