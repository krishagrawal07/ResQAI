import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {GOOGLE_MAPS_API_KEY} from '@env';
import {
  COLORS,
  DARK_MAP_STYLE,
  DEFAULT_REGION,
  FONTS,
} from '../utils/constants';
import LocationService from '../services/LocationService';
import {MapZoomShell, PulsingLocationMarker} from './EmergencyAnimations';
import {LoadingSkeletonCard} from './MicroInteractions';

export default function LiveMap({
  location,
  dispatchLog = [],
  followUserLocation = true,
  onUserLocationChange,
  title,
}) {
  const mapRef = useRef(null);
  const lastNativeLocationRef = useRef({lat: 0, lng: 0, timestamp: 0});
  const googleMapsKey = String(GOOGLE_MAPS_API_KEY || '').trim();
  const hasGoogleMapsKey = googleMapsKey && googleMapsKey !== 'your_key_here';
  const canRenderNativeGoogleMap =
    Platform.OS !== 'android' || hasGoogleMapsKey;

  const dispatchMarkers = useMemo(
    () =>
      dispatchLog.filter(item => item.coordinate?.lat && item.coordinate?.lng),
    [dispatchLog],
  );
  const hasLiveLocation = Boolean(location?.lat && location?.lng);
  const region = useMemo(
    () => ({
      latitude: location?.lat || DEFAULT_REGION.latitude,
      longitude: location?.lng || DEFAULT_REGION.longitude,
      latitudeDelta: hasLiveLocation ? 0.012 : DEFAULT_REGION.latitudeDelta,
      longitudeDelta: hasLiveLocation ? 0.012 : DEFAULT_REGION.longitudeDelta,
    }),
    [hasLiveLocation, location?.lat, location?.lng],
  );
  const overlayTitle =
    title || (dispatchMarkers.length > 0 ? 'Live routing' : 'Phone GPS live');
  const overlayText =
    dispatchMarkers.length > 0
      ? `${dispatchMarkers.length} support lane${
          dispatchMarkers.length > 1 ? 's' : ''
        } active`
      : hasLiveLocation
      ? `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`
      : 'Waiting for phone GPS lock';

  useEffect(() => {
    if (!canRenderNativeGoogleMap || !mapRef.current) {
      return;
    }

    mapRef.current.animateToRegion(region, 850);
  }, [canRenderNativeGoogleMap, region]);

  const handleNativeUserLocationChange = useCallback(
    event => {
      const coordinate = event.nativeEvent?.coordinate;
      if (!coordinate?.latitude || !coordinate?.longitude) {
        return;
      }

      const nextLocation = {
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        accuracy: coordinate.accuracy,
        heading: coordinate.heading,
        speed:
          Number.isFinite(coordinate.speed) && coordinate.speed > 0
            ? coordinate.speed * 3.6
            : 0,
        source: 'phone-gps',
      };
      const lastLocation = lastNativeLocationRef.current;
      const timestamp = Date.now();
      const moved =
        Math.abs(lastLocation.lat - nextLocation.lat) > 0.00001 ||
        Math.abs(lastLocation.lng - nextLocation.lng) > 0.00001;

      if (!moved && timestamp - lastLocation.timestamp < 1500) {
        return;
      }

      lastNativeLocationRef.current = {
        lat: nextLocation.lat,
        lng: nextLocation.lng,
        timestamp,
      };
      onUserLocationChange?.(nextLocation);
    },
    [onUserLocationChange],
  );
  const handleOpenGoogleMaps = useCallback(async () => {
    if (!hasLiveLocation) {
      Alert.alert('Waiting for GPS', 'Get a phone GPS lock first.');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Map unavailable', 'Unable to open Google Maps right now.');
    }
  }, [hasLiveLocation, location?.lat, location?.lng]);

  useEffect(() => {
    if (canRenderNativeGoogleMap || !onUserLocationChange) {
      return undefined;
    }

    let isMounted = true;

    const syncFallbackGps = async () => {
      try {
        const nextLocation = await LocationService.getCurrentLocation();
        if (isMounted) {
          onUserLocationChange({
            ...nextLocation,
            source: 'phone-gps-fallback',
          });
        }
      } catch (error) {
        // Permission prompts and GPS failures are surfaced elsewhere in the app.
      }
    };

    syncFallbackGps();
    const intervalId = setInterval(syncFallbackGps, 6000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [canRenderNativeGoogleMap, onUserLocationChange]);

  return (
    <View style={styles.wrapper}>
      <MapZoomShell
        triggerKey={`${region.latitude}:${region.longitude}:${dispatchMarkers.length}`}>
        {canRenderNativeGoogleMap ? (
          <MapView
            customMapStyle={DARK_MAP_STYLE}
            followsUserLocation={followUserLocation}
            initialRegion={region}
            loadingEnabled
            mapType="standard"
            onUserLocationChange={handleNativeUserLocationChange}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            ref={mapRef}
            showsCompass={false}
            showsMyLocationButton
            showsUserLocation
            style={styles.map}>
            {hasLiveLocation && (
              <Marker
                coordinate={{latitude: location.lat, longitude: location.lng}}>
                <PulsingLocationMarker />
              </Marker>
            )}

            {dispatchMarkers.map(item => (
              <React.Fragment key={item.id}>
                <Marker
                  coordinate={{
                    latitude: item.coordinate.lat,
                    longitude: item.coordinate.lng,
                  }}>
                  <View
                    style={[styles.dispatchMarker, {borderColor: item.color}]}>
                    <View
                      style={[
                        styles.dispatchCore,
                        {backgroundColor: item.color},
                      ]}
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
        ) : (
          <View style={styles.gpsFallback}>
            <View style={styles.fallbackCore}>
              <PulsingLocationMarker />
            </View>
            <Text style={styles.fallbackTitle}>Phone GPS is connected</Text>
            <Text style={styles.fallbackCoords}>
              {hasLiveLocation
                ? `${Number(location.lat).toFixed(5)}, ${Number(
                    location.lng,
                  ).toFixed(5)}`
                : 'Waiting for GPS lock...'}
            </Text>
            <Text style={styles.fallbackCopy}>
              Add a real Android Maps SDK key to render the in-app Google map.
              Until then, this panel tracks GPS and opens the same pin in Google
              Maps.
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!hasLiveLocation}
              onPress={handleOpenGoogleMaps}
              style={[
                styles.openMapsButton,
                !hasLiveLocation ? styles.openMapsButtonDisabled : null,
              ]}>
              <Text style={styles.openMapsButtonText}>
                {hasLiveLocation
                  ? 'Open live pin in Google Maps'
                  : 'Getting GPS'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </MapZoomShell>

      {!hasLiveLocation ? <LoadingSkeletonCard /> : null}

      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayTitle}>{overlayTitle}</Text>
        <Text style={styles.mapOverlayText}>{overlayText}</Text>
      </View>

      <View style={styles.googleBadge}>
        <Text style={styles.googleBadgeText}>Google Maps GPS</Text>
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
  gpsFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    marginBottom: 14,
  },
  fallbackTitle: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  fallbackCoords: {
    color: COLORS.CYAN,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    fontFamily: FONTS.mono,
  },
  fallbackCopy: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    maxWidth: 290,
    textAlign: 'center',
    fontFamily: FONTS.body,
  },
  openMapsButton: {
    backgroundColor: COLORS.CYAN,
    borderRadius: 999,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  openMapsButtonDisabled: {
    opacity: 0.45,
  },
  openMapsButtonText: {
    color: COLORS.BG,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.strong,
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
  googleBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 8, 22, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  googleBadgeText: {
    color: COLORS.CYAN,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONTS.strong,
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
