import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DispatchLog from '../components/DispatchLog';
import LiveMap from '../components/LiveMap';
import {useAppContext} from '../context/AppContext';
import DispatchService from '../services/DispatchService';
import {COLORS} from '../utils/constants';
import {formatCoordinates} from '../utils/helpers';

export default function DispatchScreen({navigation}) {
  const {
    state: {dispatchLog, location, sosTriggered, userProfile, runtime},
    dispatch,
  } = useAppContext();
  const bannerBlink = useRef(new Animated.Value(1)).current;
  const [showDispatchedCard, setShowDispatchedCard] = useState(false);
  const allDispatched = dispatchLog.length >= 4;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bannerBlink, {
          toValue: 0.25,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(bannerBlink, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    if (sosTriggered && !allDispatched) {
      loop.start();
    }

    return () => loop.stop();
  }, [allDispatched, bannerBlink, sosTriggered]);

  useEffect(() => {
    let completionTimer;

    if (
      sosTriggered &&
      location.lat &&
      location.lng &&
      dispatchLog.length === 0
    ) {
      DispatchService.startDispatchSequence({
        location,
        userProfile,
        onDispatch: entry => {
          dispatch({type: 'ADD_DISPATCH_LOG', payload: entry});
        },
      });
    }

    if (sosTriggered) {
      completionTimer = setTimeout(() => {
        setShowDispatchedCard(true);
      }, 7000);
    } else {
      setShowDispatchedCard(false);
    }

    return () => clearTimeout(completionTimer);
  }, [dispatch, dispatchLog.length, location, sosTriggered, userProfile]);

  const handleReset = async () => {
    DispatchService.stopDispatchSequence();
    dispatch({type: 'RESET_CRASH'});
    navigation.navigate('Monitor');
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
        value: `${dispatchLog.length}/4 live`,
      },
      {
        key: 'feed',
        label: 'Data source',
        value: runtime.sensorSource === 'preview' ? 'Preview' : 'Live',
      },
      {
        key: 'eta',
        label: 'Best ETA',
        value: allDispatched ? '4 min' : '2-4 min',
      },
    ],
    [allDispatched, dispatchLog.length, runtime.sensorSource],
  );

  const checklist = [
    {
      key: 'gps',
      label: 'GPS pin confirmed',
      done: Boolean(location.lat && location.lng),
    },
    {
      key: 'contact',
      label: 'Emergency contact queued',
      done: dispatchLog.some(item => item.type === 'contact'),
    },
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
  ];

  const heroPulseColorStyle =
    heroTone.accent === COLORS.GREEN
      ? styles.heroPulseGreen
      : heroTone.accent === COLORS.PINK
      ? styles.heroPulsePink
      : styles.heroPulseCyan;
  const heroPulseOpacityStyle =
    sosTriggered && !allDispatched
      ? {opacity: bannerBlink}
      : styles.heroPulseIdle;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <LinearGradient
        colors={['#10192B', '#131F35', '#16243D']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.hero}>
        <View style={styles.heroBadge}>
          <Animated.View
            style={[
              styles.heroPulse,
              heroPulseColorStyle,
              heroPulseOpacityStyle,
            ]}
          />
          <Text style={[styles.heroBadgeText, {color: heroTone.accent}]}>
            {heroTone.badge}
          </Text>
        </View>

        <Text style={styles.heroTitle}>Rescue coordination desk</Text>
        <Text style={styles.heroCopy}>{heroTone.copy}</Text>

        <View style={styles.heroCardsRow}>
          {responseCards.map(card => (
            <View key={card.key} style={styles.heroMetricCard}>
              <Text style={styles.heroMetricLabel}>{card.label}</Text>
              <Text style={styles.heroMetricValue}>{card.value}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

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
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dispatch timeline</Text>
        <Text style={styles.sectionCaption}>
          Who is being engaged right now
        </Text>
      </View>
      <DispatchLog items={dispatchLog} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rescue map</Text>
        <Text style={styles.sectionCaption}>
          Route lines update as support points get attached
        </Text>
      </View>
      <LiveMap dispatchLog={dispatchLog} location={location} />

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

      {showDispatchedCard && allDispatched ? (
        <View style={styles.completedCard}>
          <Text style={styles.completedTitle}>
            All support lanes are active
          </Text>
          <Text style={styles.completedEta}>
            Best estimated arrival is about 4 minutes.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleReset}
        style={styles.resetButton}>
        <Ionicons color={COLORS.TEXT} name="arrow-back-outline" size={18} />
        <Text style={styles.resetButtonText}>Return to Protect</Text>
      </TouchableOpacity>
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
    paddingBottom: 120,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPulse: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
  },
  heroPulseCyan: {
    backgroundColor: COLORS.CYAN,
  },
  heroPulseGreen: {
    backgroundColor: COLORS.GREEN,
  },
  heroPulsePink: {
    backgroundColor: COLORS.PINK,
  },
  heroPulseIdle: {
    opacity: 1,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    marginTop: 22,
    color: COLORS.TEXT,
    fontSize: 27,
    fontWeight: '800',
  },
  heroCopy: {
    marginTop: 10,
    color: COLORS.TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
  },
  heroCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  heroMetricCard: {
    width: '31%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  heroMetricLabel: {
    color: COLORS.MUTED2,
    fontSize: 11,
    marginBottom: 6,
  },
  heroMetricValue: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  gpsCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
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
  },
  coords: {
    color: COLORS.CYAN,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    fontFamily: 'monospace',
  },
  address: {
    color: COLORS.MUTED2,
    marginTop: 10,
    lineHeight: 20,
    fontSize: 13,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionCaption: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
  },
  checklistCard: {
    backgroundColor: COLORS.CARD,
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
  },
  completedEta: {
    color: COLORS.TEXT,
    marginTop: 8,
    fontSize: 13,
  },
  resetButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.CARD_ALT,
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
  },
});
