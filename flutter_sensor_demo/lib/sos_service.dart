import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

enum SosPresentationMode {
  fullScreenAlert,
  systemNotification,
}

class SosSnapshot {
  const SosSnapshot({
    required this.remainingSeconds,
    required this.totalSeconds,
    required this.progress,
    required this.mode,
    required this.startedAt,
  });

  final int remainingSeconds;
  final int totalSeconds;
  final double progress;
  final SosPresentationMode mode;
  final DateTime startedAt;
}

class SosService {
  Timer? _countdownTimer;
  Timer? _alarmTimer;
  Timer? _vibrationTimer;

  int _remainingSeconds = 0;
  int _totalSeconds = 0;
  DateTime? _startedAt;
  SosPresentationMode? _activeMode;

  int? _notificationId;
  FlutterLocalNotificationsPlugin? _notifications;
  String? _notificationChannelId;
  String? _notificationChannelName;
  String? _notificationChannelDescription;
  String _notificationSound = 'sos_alert';
  String _notificationTitle = 'Possible accident detected';
  String _notificationBody =
      'Open ResQ AI and tap "I\'m Safe" to cancel emergency outreach.';

  bool get isRunning => _countdownTimer != null;
  int get remainingSeconds => _remainingSeconds;
  int get totalSeconds => _totalSeconds;
  SosPresentationMode? get activeMode => _activeMode;

  double get progress {
    if (_totalSeconds <= 0) {
      return 0.0;
    }
    return (_remainingSeconds / _totalSeconds).clamp(0.0, 1.0);
  }

  SosSnapshot? get snapshot {
    final startedAt = _startedAt;
    final mode = _activeMode;
    if (!isRunning || startedAt == null || mode == null) {
      return null;
    }

    return SosSnapshot(
      remainingSeconds: _remainingSeconds,
      totalSeconds: _totalSeconds,
      progress: progress,
      mode: mode,
      startedAt: startedAt,
    );
  }

  Future<void> startCountdown({
    int seconds = 10,
    required void Function(int remainingSeconds) onTick,
    required Future<void> Function() onTimeout,
    bool isUiVisible = true,
    FlutterLocalNotificationsPlugin? notifications,
    int notificationId = 1741,
    String notificationTitle = 'Possible accident detected',
    String notificationBody =
        'Open ResQ AI and tap "I\'m Safe" to cancel emergency outreach.',
    String notificationChannelId = 'resqai_sos_channel',
    String notificationChannelName = 'SOS Alerts',
    String notificationChannelDescription =
        'High-priority SOS countdown alerts',
    String notificationSound = 'sos_alert',
    Future<void> Function(SosPresentationMode mode)? onModeResolved,
    Future<void> Function(double progress)? onProgress,
  }) async {
    if (isRunning) {
      return;
    }

    _remainingSeconds = seconds;
    _totalSeconds = seconds;
    _startedAt = DateTime.now();
    _activeMode = isUiVisible
        ? SosPresentationMode.fullScreenAlert
        : SosPresentationMode.systemNotification;
    _notificationSound = notificationSound;
    _notificationTitle = notificationTitle;
    _notificationBody = notificationBody;

    if (notifications != null) {
      _notifications = notifications;
      _notificationId = notificationId;
      _notificationChannelId = notificationChannelId;
      _notificationChannelName = notificationChannelName;
      _notificationChannelDescription = notificationChannelDescription;
    }

    if (_activeMode == SosPresentationMode.systemNotification &&
        notifications != null) {
      await _showSystemLevelSosNotification(
        notifications: notifications,
        notificationId: notificationId,
        title: notificationTitle,
        body: notificationBody,
        channelId: notificationChannelId,
        channelName: notificationChannelName,
        channelDescription: notificationChannelDescription,
        soundName: notificationSound,
        remainingSeconds: _remainingSeconds,
        withFullScreenIntent: true,
      );
    }

    await onModeResolved?.call(_activeMode!);

    _startAttentionEffects();

    onTick(_remainingSeconds);
    await onProgress?.call(progress);

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) async {
      _remainingSeconds -= 1;
      if (_remainingSeconds <= 0) {
        timer.cancel();
        _countdownTimer = null;
        _remainingSeconds = 0;
        _stopAttentionEffects();
        await _dismissSystemLevelSosNotification();
        await onTimeout();
        _resetStateAfterCompletion();
        return;
      }

      onTick(_remainingSeconds);
      await onProgress?.call(progress);

      if (_activeMode == SosPresentationMode.systemNotification) {
        await _refreshSystemLevelSosNotification();
      }
    });
  }

  Future<void> cancel() async {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _remainingSeconds = 0;
    _stopAttentionEffects();
    await _dismissSystemLevelSosNotification();
    _resetStateAfterCompletion();
  }

  void _resetStateAfterCompletion() {
    _activeMode = null;
    _totalSeconds = 0;
    _startedAt = null;
  }

  void _startAttentionEffects() {
    _alarmTimer?.cancel();
    _vibrationTimer?.cancel();

    unawaited(SystemSound.play(SystemSoundType.alert));
    _alarmTimer = Timer.periodic(const Duration(milliseconds: 650), (_) {
      unawaited(SystemSound.play(SystemSoundType.alert));
    });

    unawaited(HapticFeedback.vibrate());
    _vibrationTimer = Timer.periodic(const Duration(milliseconds: 650), (_) {
      unawaited(HapticFeedback.vibrate());
    });
  }

  void _stopAttentionEffects() {
    _alarmTimer?.cancel();
    _vibrationTimer?.cancel();
    _alarmTimer = null;
    _vibrationTimer = null;
  }

  Future<void> _showSystemLevelSosNotification({
    required FlutterLocalNotificationsPlugin notifications,
    required int notificationId,
    required String title,
    required String body,
    required String channelId,
    required String channelName,
    required String channelDescription,
    required String soundName,
    required int remainingSeconds,
    bool withFullScreenIntent = false,
  }) async {
    await notifications.show(
      notificationId,
      title,
      _buildCountdownBody(body, remainingSeconds),
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: channelDescription,
          importance: Importance.max,
          priority: Priority.high,
          category: AndroidNotificationCategory.alarm,
          fullScreenIntent: withFullScreenIntent,
          ongoing: true,
          autoCancel: false,
          playSound: true,
          sound: RawResourceAndroidNotificationSound(soundName),
          audioAttributesUsage: AudioAttributesUsage.alarm,
          onlyAlertOnce: false,
          enableVibration: true,
          vibrationPattern: Int64List.fromList(
            <int>[0, 700, 400, 700, 400],
          ),
        ),
      ),
    );
  }

  String _buildCountdownBody(String body, int remainingSeconds) {
    return '$body Auto emergency in ${remainingSeconds}s.';
  }

  Future<void> _refreshSystemLevelSosNotification() async {
    final notifications = _notifications;
    final notificationId = _notificationId;
    final channelId = _notificationChannelId;
    final channelName = _notificationChannelName;
    final channelDescription = _notificationChannelDescription;
    if (notifications == null ||
        notificationId == null ||
        channelId == null ||
        channelName == null ||
        channelDescription == null) {
      return;
    }

    await _showSystemLevelSosNotification(
      notifications: notifications,
      notificationId: notificationId,
      title: _notificationTitle,
      body: _notificationBody,
      channelId: channelId,
      channelName: channelName,
      channelDescription: channelDescription,
      soundName: _notificationSound,
      remainingSeconds: _remainingSeconds,
      withFullScreenIntent: false,
    );
  }

  Future<void> _dismissSystemLevelSosNotification() async {
    final notifications = _notifications;
    final notificationId = _notificationId;

    if (notifications == null || notificationId == null) {
      return;
    }

    await notifications.cancel(notificationId);
    _notifications = null;
    _notificationId = null;
    _notificationChannelId = null;
    _notificationChannelName = null;
    _notificationChannelDescription = null;
  }
}
