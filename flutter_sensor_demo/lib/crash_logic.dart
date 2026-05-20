class CrashThresholdConfig {
  const CrashThresholdConfig({
    this.accelerationThreshold = 21.5,
    this.speedDropThresholdKmh = 20,
    this.rotationAbnormalThreshold = 3.8,
    this.minorAccelerationIgnoreThreshold = 9.5,
    this.minorSpeedDropIgnoreThresholdKmh = 4.0,
    this.minorRotationIgnoreThreshold = 1.2,
  });

  final double accelerationThreshold;
  final double speedDropThresholdKmh;
  final double rotationAbnormalThreshold;
  final double minorAccelerationIgnoreThreshold;
  final double minorSpeedDropIgnoreThresholdKmh;
  final double minorRotationIgnoreThreshold;

  CrashThresholdConfig copyWith({
    double? accelerationThreshold,
    double? speedDropThresholdKmh,
    double? rotationAbnormalThreshold,
    double? minorAccelerationIgnoreThreshold,
    double? minorSpeedDropIgnoreThresholdKmh,
    double? minorRotationIgnoreThreshold,
  }) {
    return CrashThresholdConfig(
      accelerationThreshold:
          accelerationThreshold ?? this.accelerationThreshold,
      speedDropThresholdKmh:
          speedDropThresholdKmh ?? this.speedDropThresholdKmh,
      rotationAbnormalThreshold:
          rotationAbnormalThreshold ?? this.rotationAbnormalThreshold,
      minorAccelerationIgnoreThreshold: minorAccelerationIgnoreThreshold ??
          this.minorAccelerationIgnoreThreshold,
      minorSpeedDropIgnoreThresholdKmh: minorSpeedDropIgnoreThresholdKmh ??
          this.minorSpeedDropIgnoreThresholdKmh,
      minorRotationIgnoreThreshold:
          minorRotationIgnoreThreshold ?? this.minorRotationIgnoreThreshold,
    );
  }

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'accelerationThreshold': accelerationThreshold,
      'speedDropThresholdKmh': speedDropThresholdKmh,
      'rotationAbnormalThreshold': rotationAbnormalThreshold,
      'minorAccelerationIgnoreThreshold': minorAccelerationIgnoreThreshold,
      'minorSpeedDropIgnoreThresholdKmh': minorSpeedDropIgnoreThresholdKmh,
      'minorRotationIgnoreThreshold': minorRotationIgnoreThreshold,
    };
  }

  factory CrashThresholdConfig.fromMap(Map<String, dynamic> map) {
    double parse(
      String key,
      double fallback,
    ) {
      final value = map[key];
      if (value is num) {
        return value.toDouble();
      }
      return double.tryParse('$value') ?? fallback;
    }

    const defaults = CrashThresholdConfig();
    return CrashThresholdConfig(
      accelerationThreshold:
          parse('accelerationThreshold', defaults.accelerationThreshold),
      speedDropThresholdKmh:
          parse('speedDropThresholdKmh', defaults.speedDropThresholdKmh),
      rotationAbnormalThreshold: parse(
          'rotationAbnormalThreshold', defaults.rotationAbnormalThreshold),
      minorAccelerationIgnoreThreshold: parse(
        'minorAccelerationIgnoreThreshold',
        defaults.minorAccelerationIgnoreThreshold,
      ),
      minorSpeedDropIgnoreThresholdKmh: parse(
        'minorSpeedDropIgnoreThresholdKmh',
        defaults.minorSpeedDropIgnoreThresholdKmh,
      ),
      minorRotationIgnoreThreshold: parse(
        'minorRotationIgnoreThreshold',
        defaults.minorRotationIgnoreThreshold,
      ),
    );
  }
}

enum CrashDecision {
  none,
  sosCountdown,
  fullEmergency,
}

class CrashAssessment {
  const CrashAssessment({
    required this.score,
    required this.decision,
    required this.accelerationTriggered,
    required this.speedDropTriggered,
    required this.rotationTriggered,
    required this.inCooldown,
    required this.duplicateSuppressed,
    required this.ignoredAsMinorMotion,
    required this.shakePatternTriggered,
  });

  final int score;
  final CrashDecision decision;
  final bool accelerationTriggered;
  final bool speedDropTriggered;
  final bool rotationTriggered;
  final bool inCooldown;
  final bool duplicateSuppressed;
  final bool ignoredAsMinorMotion;
  final bool shakePatternTriggered;

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'score': score,
      'decision': decision.name,
      'accelerationTriggered': accelerationTriggered,
      'speedDropTriggered': speedDropTriggered,
      'rotationTriggered': rotationTriggered,
      'inCooldown': inCooldown,
      'duplicateSuppressed': duplicateSuppressed,
      'ignoredAsMinorMotion': ignoredAsMinorMotion,
      'shakePatternTriggered': shakePatternTriggered,
    };
  }
}

class CrashLogic {
  CrashLogic({
    this.cooldown = const Duration(seconds: 30),
    this.duplicateSuppressionWindow = const Duration(seconds: 8),
    CrashThresholdConfig thresholdConfig = const CrashThresholdConfig(),
  }) : _thresholdConfig = thresholdConfig;

  final Duration cooldown;
  final Duration duplicateSuppressionWindow;
  CrashThresholdConfig _thresholdConfig;

  CrashThresholdConfig get thresholdConfig => _thresholdConfig;

  void updateThresholdConfig(CrashThresholdConfig config) {
    _thresholdConfig = config;
  }

  void updateThresholdConfigFromMap(Map<String, dynamic> map) {
    updateThresholdConfig(
      CrashThresholdConfig.fromMap(map),
    );
  }

  DateTime? _lastTriggerAt;
  String? _lastTriggerKey;
  DateTime? _lastShakeImpulseAt;
  double? _lastAccelerationMagnitude;
  int _shakeImpulseCount = 0;

  static const Duration _shakeBurstWindow = Duration(milliseconds: 2500);
  static const Duration _shakeMinImpulseSpacing = Duration(milliseconds: 140);
  static const int _shakeBurstEventsForSos = 3;

  bool get hasTriggeredBefore => _lastTriggerAt != null;

  bool isInCooldown(DateTime now) {
    final last = _lastTriggerAt;
    if (last == null) {
      return false;
    }
    return now.difference(last) < cooldown;
  }

  bool isDuplicateTrigger({
    required DateTime now,
    required String triggerKey,
  }) {
    final lastTriggeredKey = _lastTriggerKey;
    final lastTriggeredAt = _lastTriggerAt;

    if (lastTriggeredKey == null || lastTriggeredAt == null) {
      return false;
    }

    if (lastTriggeredKey != triggerKey) {
      return false;
    }

    return now.difference(lastTriggeredAt) < duplicateSuppressionWindow;
  }

  void registerTrigger(
    DateTime triggeredAt, {
    required String triggerKey,
  }) {
    _lastTriggerAt = triggeredAt;
    _lastTriggerKey = triggerKey;
    _lastShakeImpulseAt = null;
    _lastAccelerationMagnitude = null;
    _shakeImpulseCount = 0;
  }

  CrashAssessment evaluate({
    required DateTime now,
    required double accelerationMagnitude,
    required double speedDropKmh,
    required double rotationMagnitude,
  }) {
    _updateShakeBurst(
      now: now,
      accelerationMagnitude: accelerationMagnitude,
      rotationMagnitude: rotationMagnitude,
    );

    final shakePatternTriggered = _shakeImpulseCount >= _shakeBurstEventsForSos;

    final minorMotionIgnored = accelerationMagnitude <
            thresholdConfig.minorAccelerationIgnoreThreshold &&
        speedDropKmh < thresholdConfig.minorSpeedDropIgnoreThresholdKmh &&
        rotationMagnitude < thresholdConfig.minorRotationIgnoreThreshold;

    if (minorMotionIgnored && !shakePatternTriggered) {
      return CrashAssessment(
        score: 0,
        decision: CrashDecision.none,
        accelerationTriggered: false,
        speedDropTriggered: false,
        rotationTriggered: false,
        inCooldown: isInCooldown(now),
        duplicateSuppressed: false,
        ignoredAsMinorMotion: true,
        shakePatternTriggered: false,
      );
    }

    var score = 0;

    final accelerationTriggered =
        accelerationMagnitude > thresholdConfig.accelerationThreshold;
    final speedDropTriggered =
        speedDropKmh > thresholdConfig.speedDropThresholdKmh;
    final rotationTriggered =
        rotationMagnitude > thresholdConfig.rotationAbnormalThreshold;

    if (accelerationTriggered) {
      score += 20;
    }
    if (speedDropTriggered) {
      score += 15;
    }
    if (rotationTriggered) {
      score += 15;
    }
    if (shakePatternTriggered && score < 20) {
      // A short burst of repeated medium-intensity movement should still open SOS.
      score = 20;
    }

    final inCooldown = isInCooldown(now);
    var duplicateSuppressed = false;

    CrashDecision decision = CrashDecision.none;
    if (!inCooldown) {
      if (score >= 40) {
        decision = CrashDecision.fullEmergency;
      } else if (score >= 20) {
        decision = CrashDecision.sosCountdown;
      }

      if (decision != CrashDecision.none &&
          isDuplicateTrigger(now: now, triggerKey: decision.name)) {
        duplicateSuppressed = true;
        decision = CrashDecision.none;
      }
    }

    return CrashAssessment(
      score: score,
      decision: decision,
      accelerationTriggered: accelerationTriggered,
      speedDropTriggered: speedDropTriggered,
      rotationTriggered: rotationTriggered,
      inCooldown: inCooldown,
      duplicateSuppressed: duplicateSuppressed,
      ignoredAsMinorMotion: false,
      shakePatternTriggered: shakePatternTriggered,
    );
  }

  CrashAssessment evaluateForcedScore({
    required DateTime now,
    required int forcedScore,
  }) {
    var decision = CrashDecision.none;
    final inCooldown = isInCooldown(now);
    var duplicateSuppressed = false;

    if (!inCooldown) {
      if (forcedScore >= 40) {
        decision = CrashDecision.fullEmergency;
      } else if (forcedScore >= 20) {
        decision = CrashDecision.sosCountdown;
      }

      if (decision != CrashDecision.none &&
          isDuplicateTrigger(now: now, triggerKey: decision.name)) {
        duplicateSuppressed = true;
        decision = CrashDecision.none;
      }
    }

    return CrashAssessment(
      score: forcedScore,
      decision: decision,
      accelerationTriggered: forcedScore >= 20,
      speedDropTriggered: forcedScore >= 30,
      rotationTriggered: forcedScore >= 35,
      inCooldown: inCooldown,
      duplicateSuppressed: duplicateSuppressed,
      ignoredAsMinorMotion: false,
      shakePatternTriggered: false,
    );
  }

  void _updateShakeBurst({
    required DateTime now,
    required double accelerationMagnitude,
    required double rotationMagnitude,
  }) {
    final gravityCompensated = (accelerationMagnitude - 9.81).abs();
    final accelerationDelta = _lastAccelerationMagnitude == null
        ? 0.0
        : (accelerationMagnitude - _lastAccelerationMagnitude!).abs();
    _lastAccelerationMagnitude = accelerationMagnitude;

    final accelShakeThreshold =
        (thresholdConfig.accelerationThreshold * 0.38).clamp(4.8, 10.5);
    final rotationShakeThreshold =
        (thresholdConfig.rotationAbnormalThreshold * 0.50).clamp(1.1, 2.8);
    final jerkShakeThreshold =
        (thresholdConfig.minorAccelerationIgnoreThreshold * 0.32)
            .clamp(1.1, 3.5);

    final shakeImpulseDetected = gravityCompensated >= accelShakeThreshold ||
        rotationMagnitude >= rotationShakeThreshold ||
        accelerationDelta >= jerkShakeThreshold;

    final lastShakeImpulseAt = _lastShakeImpulseAt;
    if (!shakeImpulseDetected) {
      if (lastShakeImpulseAt != null &&
          now.difference(lastShakeImpulseAt) > _shakeBurstWindow) {
        _shakeImpulseCount = 0;
        _lastShakeImpulseAt = null;
      }
      return;
    }

    if (lastShakeImpulseAt == null ||
        now.difference(lastShakeImpulseAt) > _shakeBurstWindow) {
      _shakeImpulseCount = 1;
      _lastShakeImpulseAt = now;
      return;
    }

    if (now.difference(lastShakeImpulseAt) < _shakeMinImpulseSpacing) {
      return;
    }

    _shakeImpulseCount += 1;
    _lastShakeImpulseAt = now;

    if (_shakeImpulseCount > 8) {
      _shakeImpulseCount = 8;
    }
  }
}
