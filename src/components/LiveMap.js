import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {
  COLORS,
  DARK_MAP_STYLE,
  DEFAULT_REGION,
  FONTS,
} from '../utils/constants';

export default function LiveMap({location, dispatchLog = []}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const region = {
    latitude: location?.lat || DEFAULT_REGION.latitude,
    longitude: location?.lng || DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  };

  const userMarkerPulse = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 0.15],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.8],
        }),
      },
    ],
  };

  const dispatchMarkers = useMemo(
    () =>
      dispatchLog.filter(item => item.coordinate?.lat && item.coordinate?.lng),
    [dispatchLog],
  );

  return (
    <View style={styles.wrapper}>
      <MapView
        customMapStyle={DARK_MAP_STYLE}
        region={region}
        mapType="standard"
        showsCompass={false}
        style={styles.map}>
        {Boolean(location?.lat && location?.lng) && (
          <Marker
            coordinate={{latitude: location.lat, longitude: location.lng}}>
            <View style={styles.userMarker}>
              <Animated.View style={[styles.userPulse, userMarkerPulse]} />
              <View style={styles.userCore} />
            </View>
          </Marker>
        )}

        {dispatchMarkers.map(item => (
          <React.Fragment key={item.id}>
            <Marker
              coordinate={{
                latitude: item.coordinate.lat,
                longitude: item.coordinate.lng,
              }}>
              <View style={[styles.dispatchMarker, {borderColor: item.color}]}>
                <View
                  style={[styles.dispatchCore, {backgroundColor: item.color}]}
                />
              </View>
            </Marker>
            {location?.lat && location?.lng ? (
              <Polyline
                coordinates={[
                  {
                    latitude: item.coordinate.lat,
                    longitude: item.coordinate.lng,
                  },
                  {latitude: location.lat, longitude: location.lng},
                ]}
                geodesic
                strokeColor={item.color}
                strokeWidth={2}
              />
            ) : null}
          </React.Fragment>
        ))}
      </MapView>

      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayTitle}>
          {dispatchMarkers.length > 0 ? 'Live routing' : 'Map preview'}
        </Text>
        <Text style={styles.mapOverlayText}>
          {dispatchMarkers.length > 0
            ? `${dispatchMarkers.length} support lane${
                dispatchMarkers.length > 1 ? 's' : ''
              } active`
            : 'Awaiting dispatch lanes'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 280,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: 'rgba(11, 17, 32, 0.8)',
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,61,107,0.45)',
  },
  userCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.PINK,
    borderWidth: 2,
    borderColor: COLORS.TEXT,
  },
  dispatchMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.CARD,
  },
  dispatchCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(5, 8, 22, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapOverlayTitle: {
    color: COLORS.TEXT,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  mapOverlayText: {
    color: COLORS.MUTED2,
    fontSize: 10,
    marginTop: 2,
    fontFamily: FONTS.body,
  },
});
