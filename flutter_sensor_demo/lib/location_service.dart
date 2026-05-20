import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class LocationPermissionResult {
  const LocationPermissionResult({
    required this.isGranted,
    this.message,
  });

  final bool isGranted;
  final String? message;
}

class LocationTelemetry {
  const LocationTelemetry({
    required this.latitude,
    required this.longitude,
    required this.speedKmh,
    required this.speedDropKmh,
    required this.timestamp,
  });

  final double latitude;
  final double longitude;
  final double speedKmh;
  final double speedDropKmh;
  final DateTime timestamp;
}

class LocationService {
  StreamSubscription<Position>? _positionSubscription;
  double? _lastSpeedKmh;

  static Future<LocationPermissionResult> ensurePermissions({
    bool requestIfNeeded = false,
  }) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return const LocationPermissionResult(
        isGranted: false,
        message: 'Location service is disabled.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied && requestIfNeeded) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      return const LocationPermissionResult(
        isGranted: false,
        message: 'Location permission denied.',
      );
    }

    if (permission == LocationPermission.deniedForever) {
      return const LocationPermissionResult(
        isGranted: false,
        message: 'Location permission denied forever. Open Android settings.',
      );
    }

    if (permission != LocationPermission.always) {
      return const LocationPermissionResult(
        isGranted: false,
        message:
            'Background location requires "Allow all the time" (LocationPermission.always).',
      );
    }

    return const LocationPermissionResult(isGranted: true);
  }

  Future<void> start({
    required void Function(LocationTelemetry telemetry) onUpdate,
    required void Function(String message) onError,
  }) async {
    await stop();
    await _prime(onUpdate);
    final locationSettings = _buildLocationSettings();

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(
      (position) {
        onUpdate(_toTelemetry(position));
      },
      onError: (Object error) {
        onError('Location stream failed: $error');
      },
      cancelOnError: false,
    );
  }

  Future<void> _prime(
    void Function(LocationTelemetry telemetry) onUpdate,
  ) async {
    try {
      final known = await Geolocator.getLastKnownPosition();
      if (known != null) {
        onUpdate(_toTelemetry(known));
        return;
      }

      final current = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation,
      );
      onUpdate(_toTelemetry(current));
    } catch (_) {
      // Stream updates will still continue after this best-effort prime attempt.
    }
  }

  Future<void> stop() async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    _lastSpeedKmh = null;
  }

  LocationTelemetry _toTelemetry(Position position) {
    final speedKmh = math.max(position.speed * 3.6, 0.0);
    final previousSpeed = _lastSpeedKmh;
    final speedDrop =
        previousSpeed == null ? 0.0 : math.max(previousSpeed - speedKmh, 0.0);

    _lastSpeedKmh = speedKmh;

    return LocationTelemetry(
      latitude: position.latitude,
      longitude: position.longitude,
      speedKmh: speedKmh,
      speedDropKmh: speedDrop,
      timestamp: position.timestamp,
    );
  }

  LocationSettings _buildLocationSettings() {
    if (Platform.isAndroid || defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
        intervalDuration: Duration(seconds: 2),
        forceLocationManager: false,
      );
    }

    return const LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 0,
    );
  }
}
