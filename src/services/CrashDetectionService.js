import {CRASH_SCORING, CRASH_THRESHOLDS} from '../utils/constants';
import {calculateMagnitude} from '../utils/helpers';

const COOLDOWN_MS = 30000;

const SENSITIVITY_PROFILES = {
  calm: {
    gyroMagnitude: 1.12,
  },
  balanced: {
    gyroMagnitude: 1,
  },
  max: {
    gyroMagnitude: 0.88,
  },
};

class CrashDetectionService {
  mode = 'biker';

  sensitivity = 'balanced';

  lastSpeed = 0;

  crashCallback = null;

  cooldown = false;

  cooldownTimeoutId = null;

  setMode(mode) {
    this.mode = mode;
  }

  setSensitivity(sensitivity = 'balanced') {
    this.sensitivity = sensitivity;
  }

  setCallback(callback) {
    this.crashCallback = callback;
  }

  reset() {
    this.lastSpeed = 0;
    this.cooldown = false;

    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
      this.cooldownTimeoutId = null;
    }
  }

  getThresholds() {
    const baseThresholds =
      CRASH_THRESHOLDS[this.mode] ?? CRASH_THRESHOLDS.biker;
    const profile =
      SENSITIVITY_PROFILES[this.sensitivity] ?? SENSITIVITY_PROFILES.balanced;

    return {
      accelerationThresholdMs2: CRASH_SCORING.accelerationThresholdMs2,
      fullEmergencyScore: CRASH_SCORING.fullEmergencyScore,
      gyroMagnitude: baseThresholds.gyroMagnitude * profile.gyroMagnitude,
      maxScore: CRASH_SCORING.maxScore,
      sosCountdownScore: CRASH_SCORING.sosCountdownScore,
      suddenSpeedDropThresholdKmh: CRASH_SCORING.suddenSpeedDropThresholdKmh,
    };
  }

  calculateTiltDeg(ax, ay, az) {
    const magnitude = calculateMagnitude(ax, ay, az);
    if (!magnitude) {
      return 0;
    }

    const normalized = Math.min(Math.abs(az) / magnitude, 1);
    return (Math.acos(normalized) * 180) / Math.PI;
  }

  buildSnapshot(sensorData = {}, thresholds, options = {}) {
    const {ax, ay, az, gx, gy, gz, speed} = sensorData;
    const accelMag = calculateMagnitude(ax, ay, az);
    const gyroMag = calculateMagnitude(gx, gy, gz);
    const sampleAt = Number(
      options.timestamp ?? sensorData.timestamp ?? Date.now(),
    );
    const providedSpeedBefore = Number(
      options.speedBeforeKmh ?? sensorData.speedBeforeKmh,
    );
    const speedBeforeKmh =
      Number.isFinite(providedSpeedBefore) && providedSpeedBefore >= 0
        ? providedSpeedBefore
        : this.lastSpeed;
    const speedAfterKmh = Number(speed) || 0;
    const providedSpeedDropKmh = Number(
      options.speedDropKmh ?? sensorData.speedDropKmh,
    );
    const derivedSpeedDropKmh = Math.max(0, speedBeforeKmh - speedAfterKmh);
    const speedDropKmh =
      Number.isFinite(providedSpeedDropKmh) && providedSpeedDropKmh >= 0
        ? providedSpeedDropKmh
        : derivedSpeedDropKmh;
    const speedDropPercent =
      speedBeforeKmh > 0 ? (speedDropKmh / speedBeforeKmh) * 100 : 0;
    const orientationTiltDeg = this.calculateTiltDeg(ax, ay, az);
    const highImpact = accelMag > thresholds.accelerationThresholdMs2;
    const suddenSpeedDrop =
      speedDropKmh > thresholds.suddenSpeedDropThresholdKmh;
    const abnormalRotation = gyroMag >= thresholds.gyroMagnitude;

    return {
      accelG: Number((accelMag / 9.81).toFixed(2)),
      accelMag: Number(accelMag.toFixed(2)),
      gyroMag: Number(gyroMag.toFixed(2)),
      orientationTiltDeg: Number(orientationTiltDeg.toFixed(2)),
      speedAfterKmh: Number(speedAfterKmh.toFixed(2)),
      speedBeforeKmh: Number(speedBeforeKmh.toFixed(2)),
      speedDropKmh: Number(speedDropKmh.toFixed(2)),
      speedDropPercent: Number(speedDropPercent.toFixed(2)),
      signals: {
        abnormalRotation,
        highImpact,
        orientationChange: abnormalRotation,
        rapidRotation: abnormalRotation,
        suddenSpeedDrop,
        suddenStop: suddenSpeedDrop,
      },
      timestamp:
        Number.isFinite(sampleAt) && sampleAt > 0 ? sampleAt : Date.now(),
    };
  }

  evaluateSeverity(snapshot, thresholds) {
    const reasons = [];
    let score = 0;

    if (snapshot.signals.highImpact) {
      score += CRASH_SCORING.highImpactPoints;
      reasons.push('Acceleration exceeded 25 m/s^2');
    }

    if (snapshot.signals.suddenSpeedDrop) {
      score += CRASH_SCORING.suddenSpeedDropPoints;
      reasons.push('Speed dropped by more than 20 km/h');
    }

    if (snapshot.signals.abnormalRotation) {
      score += CRASH_SCORING.abnormalRotationPoints;
      reasons.push('Gyroscope detected abnormal rotation');
    }

    let label = 'Low';
    let action = 'ignore';

    if (score >= thresholds.fullEmergencyScore) {
      label = 'Critical';
      action = 'full-emergency';
    } else if (score >= thresholds.sosCountdownScore) {
      label = 'Medium';
      action = 'sos-countdown';
    }

    return {
      action,
      label,
      reasons,
      score,
    };
  }

  previewSeverity(sensorData, options = {}) {
    const thresholds = this.getThresholds();
    const snapshot = this.buildSnapshot(sensorData, thresholds, options);

    return {
      snapshot,
      severity: this.evaluateSeverity(snapshot, thresholds),
    };
  }

  startCooldown() {
    this.cooldown = true;

    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
    }

    this.cooldownTimeoutId = setTimeout(() => {
      this.cooldown = false;
      this.cooldownTimeoutId = null;
    }, COOLDOWN_MS);
  }

  buildPayload(snapshot, severity) {
    return {
      action: severity.action,
      detectedAt: new Date().toISOString(),
      severity,
      snapshot,
    };
  }

  triggerFullEmergency(payload) {
    this.startCooldown();
    this.crashCallback?.(payload);
    return payload;
  }

  triggerSOSCountdown(payload) {
    this.startCooldown();
    this.crashCallback?.(payload);
    return payload;
  }

  check(sensorData) {
    if (this.cooldown) {
      return null;
    }

    const thresholds = this.getThresholds();
    const snapshot = this.buildSnapshot(sensorData, thresholds, {
      timestamp: Date.now(),
    });
    const providedSpeed = Number(sensorData?.speed);

    if (Number.isFinite(providedSpeed) && providedSpeed >= 0) {
      this.lastSpeed = providedSpeed;
    }

    const severity = this.evaluateSeverity(snapshot, thresholds);

    if (severity.action === 'ignore') {
      return null;
    }

    const payload = this.buildPayload(snapshot, severity);

    if (severity.action === 'full-emergency') {
      return this.triggerFullEmergency(payload);
    }

    return this.triggerSOSCountdown(payload);
  }
}

export default new CrashDetectionService();
