import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useAppContext} from '../context/AppContext';
import DispatchLog from '../components/DispatchLog';
import LiveMap from '../components/LiveMap';
import DispatchService from '../services/DispatchService';
import {COLORS} from '../utils/constants';
import {formatCoordinates} from '../utils/helpers';

export default function DispatchScreen({navigation}) {
  const {
    state: {dispatchLog, location, sosTriggered, userProfile},
    dispatch,
  } = useAppContext();
  const bannerBlink = useRef(new Animated.Value(1)).current;
  const [showDispatchedCard, setShowDispatchedCard] = useState(false);
  const allDispatched = dispatchLog.length >= 4;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bannerBlink, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(bannerBlink, {
          toValue: 1,
          duration: 600,
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

  const handleReset = () => {
    DispatchService.stopDispatchSequence();
    dispatch({type: 'RESET_CRASH'});
    navigation.navigate('Monitor');
  };

  const bannerState = !sosTriggered
    ? {
        borderColor: COLORS.MUTED,
        text: 'AWAITING TRIGGER',
        textColor: COLORS.MUTED2,
      }
    : allDispatched
    ? {
        borderColor: COLORS.GREEN,
        text: '✅ ALL UNITS DISPATCHED',
        textColor: COLORS.GREEN,
      }
    : {
        borderColor: COLORS.PINK,
        text: 'DISPATCHING EMERGENCY UNITS',
        textColor: COLORS.PINK,
      };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={[styles.banner, {borderColor: bannerState.borderColor}]}>
        {sosTriggered && !allDispatched ? (
          <Animated.View style={[styles.bannerDot, {opacity: bannerBlink}]} />
        ) : null}
        <Text style={[styles.bannerText, {color: bannerState.textColor}]}>
          {bannerState.text}
        </Text>
      </View>

      <View style={styles.gpsCard}>
        <Text style={styles.cardLabel}>📍 GPS LOCK</Text>
        <View style={styles.gpsRow}>
          <View style={styles.gpsInfo}>
            <Text style={styles.coords}>
              {formatCoordinates(location.lat, location.lng)}
            </Text>
            <Text style={styles.address}>
              {location.address || 'Waiting for reverse geocoding...'}
            </Text>
          </View>
          <View style={styles.gpsBadge}>
            <Text style={styles.gpsBadgeText}>ACQUIRED ✓</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Dispatch Log</Text>
      <DispatchLog items={dispatchLog} />

      <Text style={styles.sectionTitle}>Live Map</Text>
      <LiveMap dispatchLog={dispatchLog} location={location} />

      {showDispatchedCard && allDispatched ? (
        <View style={styles.completedCard}>
          <Text style={styles.completedTitle}>✅ ALL UNITS DISPATCHED</Text>
          <Text style={styles.completedEta}>Estimated arrival: ~4 minutes</Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleReset}
        style={styles.resetButton}>
        <Text style={styles.resetButtonText}>RESET AND RETURN TO MONITOR</Text>
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
    paddingBottom: 28,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.PINK,
    marginRight: 10,
  },
  bannerText: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  gpsCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.08)',
  },
  cardLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 10,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gpsInfo: {
    flex: 1,
    paddingRight: 12,
  },
  coords: {
    color: COLORS.CYAN,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
  },
  address: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  gpsBadge: {
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderColor: COLORS.GREEN,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gpsBadgeText: {
    color: COLORS.GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  completedCard: {
    marginTop: 16,
    backgroundColor: 'rgba(0,255,136,0.07)',
    borderColor: COLORS.GREEN,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  completedTitle: {
    color: COLORS.GREEN,
    fontSize: 16,
    fontWeight: '800',
  },
  completedEta: {
    color: COLORS.YELLOW,
    marginTop: 6,
    fontWeight: '700',
  },
  resetButton: {
    marginTop: 18,
    backgroundColor: COLORS.BG2,
    borderColor: COLORS.MUTED,
    borderWidth: 1,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: COLORS.TEXT,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
