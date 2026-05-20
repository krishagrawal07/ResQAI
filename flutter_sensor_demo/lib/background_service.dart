import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'crash_settings_store.dart';
import 'crash_logic.dart';
import 'emergency_service.dart';
import 'incident_history_store.dart';
import 'log_store.dart';
import 'location_service.dart';
import 'sensor_service.dart';
import 'sos_service.dart';

const String kMonitoringChannelId = 'resqai_monitoring_channel';
const int kMonitoringNotificationId = 1740;
const String kMonitoringNotificationTitle = 'ResQ AI Safety Monitor';
const String kMonitoringNotificationContent =
    'ResQ AI is actively monitoring for accidents';
const String kSosChannelId = 'resqai_sos_channel_v2';
const int kSosNotificationId = 1741;
const String kSosNotificationSound = 'sos_alert';

Future<void> initializeBackgroundService() async {
  final service = FlutterBackgroundService();

  const monitoringChannel = AndroidNotificationChannel(
    kMonitoringChannelId,
    'Accident Monitoring',
    description: 'Foreground service for continuous crash detection',
    importance: Importance.high,
  );
  const sosChannel = AndroidNotificationChannel(
    kSosChannelId,
    'SOS Alerts',
    description: 'High-priority SOS countdown alerts',
    importance: Importance.high,
    playSound: true,
    sound: RawResourceAndroidNotificationSound(kSosNotificationSound),
    audioAttributesUsage: AudioAttributesUsage.alarm,
  );

  final localNotifications = FlutterLocalNotificationsPlugin();

  if (defaultTargetPlatform == TargetPlatform.android) {
    await localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(monitoringChannel);
    await localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(sosChannel);
  }

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onBackgroundServiceStart,
      autoStart: true,
      autoStartOnBoot: true,
      isForegroundMode: true,
      foregroundServiceTypes: <AndroidForegroundType>[
        AndroidForegroundType.location,
      ],
      notificationChannelId: kMonitoringChannelId,
      initialNotificationTitle: kMonitoringNotificationTitle,
      initialNotificationContent: kMonitoringNotificationContent,
      foregroundServiceNotificationId: kMonitoringNotificationId,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: onBackgroundServiceStart,
      onBackground: onIosBackground,
    ),
  );

  final alreadyRunning = await service.isRunning();
  if (!alreadyRunning) {
    await service.startService();
  }
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
Future<void> onBackgroundServiceStart(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();

  final localNotifications = FlutterLocalNotificationsPlugin();

  if (defaultTargetPlatform == TargetPlatform.android) {
    await localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
  }

  if (service is AndroidServiceInstance) {
    await service.setAsForegroundService();
  }

  final storedThresholds = await CrashSettingsStore.load();
  final crashLogic = CrashLogic(
    thresholdConfig: storedThresholds,
  );
  final sensorService = SensorService();
  final locationService = LocationService();
  final sosService = SosService();
  final emergencyService = EmergencyService();

  var contacts = await emergencyService.loadContacts();
  final serviceStartedAt = DateTime.now();

  var accelerationMagnitude = 0.0;
  var rotationMagnitude = 0.0;
  var speedKmh = 0.0;
  var speedDropKmh = 0.0;
  var latitude = 0.0;
  var longitude = 0.0;
  var hasLocation = false;
  var latestScore = 0;
  var status = kMonitoringNotificationContent;
  var emergencyFlowActive = false;
  var isUiVisible = false;
  DateTime? lastSensorLogAt;
  DateTime? lastSensorAt;
  DateTime? lastLocationAt;
  DateTime? lastCooldownNoticeAt;
  int? lastLoggedScore;

  Future<void> updateForegroundNotification() async {
    if (service is! AndroidServiceInstance) {
      return;
    }

    service.setForegroundNotificationInfo(
      title: kMonitoringNotificationTitle,
      content: kMonitoringNotificationContent,
    );
  }

  Future<void> appendServiceLog(
    String message, {
    String level = 'info',
  }) async {
    final timestamp = DateTime.now();
    try {
      await MonitoringLogStore.append(
        message,
        timestamp: timestamp,
        level: level,
      );
    } catch (_) {
      // Logging should never crash the monitoring isolate.
    }

    service.invoke(
      'service_log',
      <String, dynamic>{
        'at': timestamp.toIso8601String(),
        'level': level,
        'message': message,
      },
    );
  }

  void maybeLogSensorSnapshot(DateTime now) {
    final last = lastSensorLogAt;
    if (last != null && now.difference(last) < const Duration(seconds: 2)) {
      return;
    }

    lastSensorLogAt = now;
    unawaited(
      appendServiceLog(
        'Sensors acc=${accelerationMagnitude.toStringAsFixed(2)} '
        'gyro=${rotationMagnitude.toStringAsFixed(2)} '
        'speed=${speedKmh.toStringAsFixed(1)}km/h '
        'drop=${speedDropKmh.toStringAsFixed(1)}km/h '
        'score=$latestScore',
      ),
    );
  }

  Future<void> clearSosNotification() async {
    if (defaultTargetPlatform != TargetPlatform.android) {
      return;
    }
    await localNotifications.cancel(kSosNotificationId);
  }

  void emitServiceHealth() {
    final now = DateTime.now();
    final uptimeSeconds = now.difference(serviceStartedAt).inSeconds;
    final sensorAgeSeconds =
        lastSensorAt == null ? null : now.difference(lastSensorAt!).inSeconds;
    final locationAgeSeconds = lastLocationAt == null
        ? null
        : now.difference(lastLocationAt!).inSeconds;

    service.invoke(
      'service_health',
      <String, dynamic>{
        'running': true,
        'monitoringActive': true,
        'status': status,
        'uptimeSeconds': uptimeSeconds,
        'hasLocation': hasLocation,
        'sensorAgeSeconds': sensorAgeSeconds,
        'locationAgeSeconds': locationAgeSeconds,
        'sosActive': sosService.isRunning,
        'emergencyFlowActive': emergencyFlowActive,
        'contactsCount': contacts.length,
      },
    );
  }

  void emitTelemetry() {
    service.invoke(
      'telemetry',
      <String, dynamic>{
        'status': status,
        'monitoringActive': true,
        'score': latestScore,
        'accelerationMagnitude': accelerationMagnitude,
        'rotationMagnitude': rotationMagnitude,
        'speedKmh': speedKmh,
        'speedDropKmh': speedDropKmh,
        'latitude': latitude,
        'longitude': longitude,
        'hasLocation': hasLocation,
        'thresholds': crashLogic.thresholdConfig.toMap(),
      },
    );
    service.invoke('service_status', <String, dynamic>{'running': true});
    emitServiceHealth();
  }

  Future<void> emitIncidentHistory() async {
    final incidents = await IncidentHistoryStore.load();
    service.invoke(
      'incident_history',
      <String, dynamic>{
        'incidents': incidents.map((e) => e.toMap()).toList(growable: false),
      },
    );
  }

  Future<void> triggerFullEmergency({
    required int score,
    required String reason,
  }) async {
    if (emergencyFlowActive) {
      return;
    }

    emergencyFlowActive = true;
    await sosService.cancel();
    await clearSosNotification();

    status = 'Emergency triggered ($reason)';
    latestScore = score;
    emitTelemetry();
    await appendServiceLog(
      'Emergency trigger fired: reason=$reason score=$score '
      'lat=${latitude.toStringAsFixed(6)} '
      'lng=${longitude.toStringAsFixed(6)}',
      level: 'warn',
    );

    final result = await emergencyService.triggerEmergency(
      triggeredAt: DateTime.now(),
      latitude: latitude,
      longitude: longitude,
      score: score,
      contacts: contacts,
    );
    await IncidentHistoryStore.append(
      IncidentRecord(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        occurredAt: DateTime.now(),
        type: 'emergency',
        reason: reason,
        score: score,
        latitude: result.latitude,
        longitude: result.longitude,
        mapsLink: result.mapsLink,
        details: '${result.smsSummary} | ${result.callSummary}',
      ),
    );
    await emitIncidentHistory();

    service.invoke(
      'emergency_triggered',
      <String, dynamic>{
        ...result.toMap(),
        'reason': reason,
        'score': score,
      },
    );

    await appendServiceLog(
      'Emergency dispatch result: ${result.smsSummary} | ${result.callSummary}',
      level: 'warn',
    );

    status = kMonitoringNotificationContent;
    emergencyFlowActive = false;
    emitTelemetry();
    await updateForegroundNotification();
  }

  Future<void> processAssessment(
    CrashAssessment assessment, {
    required String source,
  }) async {
    final previousScore = latestScore;
    latestScore = assessment.score;
    emitTelemetry();

    if (assessment.ignoredAsMinorMotion) {
      return;
    }

    if (assessment.inCooldown && assessment.score >= 20) {
      final now = DateTime.now();
      if (lastCooldownNoticeAt == null ||
          now.difference(lastCooldownNoticeAt!) > const Duration(seconds: 4)) {
        lastCooldownNoticeAt = now;
        unawaited(
          appendServiceLog(
            'Crash signal detected but ignored during 30s cooldown.',
            level: 'warn',
          ),
        );
      }
      return;
    }

    if (previousScore != latestScore && lastLoggedScore != latestScore) {
      lastLoggedScore = latestScore;
      unawaited(
        appendServiceLog(
          'Crash score updated to $latestScore from $source',
          level: latestScore >= 20 ? 'warn' : 'info',
        ),
      );
    }

    if (assessment.duplicateSuppressed) {
      unawaited(
        appendServiceLog(
          'Duplicate trigger suppressed at score=${assessment.score}.',
          level: 'warn',
        ),
      );
      return;
    }

    if (assessment.decision == CrashDecision.none) {
      return;
    }

    if (emergencyFlowActive) {
      return;
    }

    if (assessment.decision == CrashDecision.fullEmergency) {
      crashLogic.registerTrigger(
        DateTime.now(),
        triggerKey: CrashDecision.fullEmergency.name,
      );
      await triggerFullEmergency(
        score: assessment.score,
        reason: 'score>=40',
      );
      return;
    }

    if (assessment.decision == CrashDecision.sosCountdown &&
        !sosService.isRunning) {
      crashLogic.registerTrigger(
        DateTime.now(),
        triggerKey: CrashDecision.sosCountdown.name,
      );
      status = 'SOS countdown started';
      emitTelemetry();
      await appendServiceLog(
        'SOS countdown started (score=${assessment.score}).',
        level: 'warn',
      );
      await IncidentHistoryStore.append(
        IncidentRecord(
          id: DateTime.now().microsecondsSinceEpoch.toString(),
          occurredAt: DateTime.now(),
          type: 'sos_countdown',
          reason: 'score>=20',
          score: assessment.score,
          latitude: latitude,
          longitude: longitude,
          mapsLink: hasLocation
              ? emergencyService.buildGoogleMapsLink(latitude, longitude)
              : null,
        ),
      );
      await emitIncidentHistory();

      service.invoke('sos_started', <String, dynamic>{
        'remainingSeconds': 10,
        'score': assessment.score,
      });

      await sosService.startCountdown(
        seconds: 10,
        isUiVisible: isUiVisible,
        notifications: localNotifications,
        notificationId: kSosNotificationId,
        notificationChannelId: kSosChannelId,
        notificationSound: kSosNotificationSound,
        onTick: (remainingSeconds) {
          service.invoke(
            'sos_countdown',
            <String, dynamic>{
              'remainingSeconds': remainingSeconds,
              'score': assessment.score,
            },
          );
        },
        onModeResolved: (mode) async {
          service.invoke(
            'sos_mode',
            <String, dynamic>{'mode': mode.name},
          );
        },
        onTimeout: () async {
          crashLogic.registerTrigger(
            DateTime.now(),
            triggerKey: CrashDecision.fullEmergency.name,
          );
          await appendServiceLog(
            'SOS countdown timed out. Escalating to full emergency.',
            level: 'warn',
          );
          await triggerFullEmergency(
            score: assessment.score,
            reason: 'SOS timeout',
          );
        },
      );
    }
  }

  Future<void> evaluateLiveCrashScore({required DateTime now}) async {
    final assessment = crashLogic.evaluate(
      now: now,
      accelerationMagnitude: accelerationMagnitude,
      speedDropKmh: speedDropKmh,
      rotationMagnitude: rotationMagnitude,
    );

    await processAssessment(
      assessment,
      source: 'live_pipeline',
    );
  }

  await appendServiceLog('Background monitoring isolate started.');
  await appendServiceLog(
    'Thresholds loaded: ${crashLogic.thresholdConfig.toMap()}',
  );
  await emitIncidentHistory();

  await sensorService.start(
    onUpdate: (telemetry) async {
      accelerationMagnitude = telemetry.accelerationMagnitude;
      rotationMagnitude = telemetry.rotationMagnitude;
      lastSensorAt = telemetry.timestamp;
      maybeLogSensorSnapshot(telemetry.timestamp);
      await evaluateLiveCrashScore(now: telemetry.timestamp);
    },
    onError: (message) {
      service.invoke('permission_error', <String, dynamic>{'message': message});
      unawaited(
        appendServiceLog(
          message,
          level: 'error',
        ),
      );
    },
  );

  final locationPermission = await LocationService.ensurePermissions(
    requestIfNeeded: false,
  );
  if (!locationPermission.isGranted) {
    service.invoke(
      'permission_error',
      <String, dynamic>{
        'message': locationPermission.message ??
            'Background location permission is not available.',
      },
    );
    unawaited(
      appendServiceLog(
        locationPermission.message ??
            'Background location permission missing for monitoring service.',
        level: 'warn',
      ),
    );
  } else {
    await appendServiceLog('Background location stream started.');
    await locationService.start(
      onUpdate: (telemetry) async {
        latitude = telemetry.latitude;
        longitude = telemetry.longitude;
        speedKmh = telemetry.speedKmh;
        speedDropKmh = telemetry.speedDropKmh;
        hasLocation = true;
        lastLocationAt = telemetry.timestamp;
        maybeLogSensorSnapshot(telemetry.timestamp);
        await evaluateLiveCrashScore(now: telemetry.timestamp);
      },
      onError: (message) {
        service
            .invoke('permission_error', <String, dynamic>{'message': message});
        unawaited(
          appendServiceLog(
            message,
            level: 'error',
          ),
        );
      },
    );
  }

  service.on('request_state').listen((event) async {
    emitTelemetry();
    if (sosService.isRunning) {
      service.invoke(
        'sos_countdown',
        <String, dynamic>{'remainingSeconds': sosService.remainingSeconds},
      );
    }
    service.invoke(
      'thresholds_updated',
      crashLogic.thresholdConfig.toMap(),
    );
    await emitIncidentHistory();
  });

  service.on('request_incident_history').listen((event) async {
    await emitIncidentHistory();
  });

  service.on('clear_incident_history').listen((event) async {
    await IncidentHistoryStore.clear();
    await emitIncidentHistory();
    await appendServiceLog('Incident history cleared by user.');
  });

  service.on('request_health').listen((event) {
    emitServiceHealth();
  });

  service.on('ui_visibility').listen((event) {
    final map = _normalizeMap(event);
    isUiVisible = map['visible'] == true;
  });

  service.on('update_thresholds').listen((event) async {
    final map = _normalizeMap(event);
    crashLogic.updateThresholdConfigFromMap(map);
    await CrashSettingsStore.save(crashLogic.thresholdConfig);
    service.invoke(
      'thresholds_updated',
      crashLogic.thresholdConfig.toMap(),
    );
    await appendServiceLog(
      'Crash thresholds updated: ${crashLogic.thresholdConfig.toMap()}',
    );
  });

  service.on('request_thresholds').listen((event) {
    service.invoke(
      'thresholds_updated',
      crashLogic.thresholdConfig.toMap(),
    );
  });

  service.on('cancel_sos').listen((event) async {
    if (!sosService.isRunning) {
      return;
    }
    await sosService.cancel();
    status = kMonitoringNotificationContent;
    service.invoke('sos_cancelled');
    unawaited(appendServiceLog('SOS cancelled by user.', level: 'warn'));
    emitTelemetry();
  });

  service.on('update_contacts').listen((event) async {
    final map = _normalizeMap(event);
    final rawContacts = map['contacts'];

    if (rawContacts is! List) {
      return;
    }

    final parsed = <EmergencyContact>[];
    for (final item in rawContacts) {
      if (item is! Map) {
        continue;
      }

      final mapped = item.map((key, value) => MapEntry(key.toString(), value));
      final contact = EmergencyContact.fromMap(mapped);
      if (contact.phone.trim().isEmpty) {
        continue;
      }
      parsed.add(contact);
    }

    contacts = parsed;
    await emergencyService.saveContacts(contacts);
    await appendServiceLog(
        'Contacts synced to background service (${contacts.length}).');
    service.invoke('service_status', <String, dynamic>{
      'running': true,
      'contacts': contacts.length,
    });
  });

  service.on('simulate_crash').listen((event) async {
    final map = _normalizeMap(event);
    final forcedScore = _asInt(map['score'], fallback: 0);
    await appendServiceLog('Simulation requested with score=$forcedScore.');

    final forced = crashLogic.evaluateForcedScore(
      now: DateTime.now(),
      forcedScore: forcedScore,
    );

    await processAssessment(
      forced,
      source: 'simulation',
    );
  });

  late final Timer heartbeat;

  service.on('stop_service').listen((event) async {
    await appendServiceLog('Background monitoring service stop requested.');
    status = 'Service stopping...';
    emitTelemetry();
    service.invoke('service_status', <String, dynamic>{'running': false});
    heartbeat.cancel();
    await sosService.cancel();
    await clearSosNotification();
    await sensorService.stop();
    await locationService.stop();
    service.invoke('service_status', <String, dynamic>{'running': false});
    await service.stopSelf();
  });

  heartbeat = Timer.periodic(const Duration(seconds: 5), (timer) async {
    emitTelemetry();
    await updateForegroundNotification();
  });

  emitTelemetry();
  await updateForegroundNotification();
}

Map<String, dynamic> _normalizeMap(dynamic event) {
  if (event is Map) {
    return event.map((key, value) => MapEntry(key.toString(), value));
  }
  return <String, dynamic>{};
}

int _asInt(dynamic value, {required int fallback}) {
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse('$value') ?? fallback;
}
