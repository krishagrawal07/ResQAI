import {CRASH_THRESHOLDS} from '../utils/constants';
import {calculateMagnitude} from '../utils/helpers';

const SENSITIVITY_PROFILES = {
  calm: {
    accelG: 1.14,
    audioDb: 1.08,
    gyroMagnitude: 1.08,
    minSpeedBeforeKmh: 1.1,
    orientationTiltDeg: 1.08,
    speedDropPercent: 1.08,
  },
  balanced: {
    accelG: 1,
    audioDb: 1,
    gyroMagnitude: 1,
    minSpeedBeforeKmh: 1,
    orientationTiltDeg: 1,
    speedDropPercent: 1,
  },
  max: {
    accelG: 0.86,
    audioDb: 0.9,
    gyroMagnitude: 0.9,
    minSpeedBeforeKmh: 0.9,
    orientationTiltDeg: 0.9,
    speedDropPercent: 0.9,
  },
};

class CrashDetectionService {
  mode = 'biker';

  sensitivity = 'balanced';

  lastSpeed = 0;

  crashCallback = null;

  cooldown = false;

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
  }

  getThresholds() {
    const baseThresholds =
      CRASH_THRESHOLDS[this.mode] ?? CRASH_THRESHOLDS.biker;
    const profile =
      SENSITIVITY_PROFILES[this.sensitivity] ?? SENSITIVITY_PROFILES.balanced;

    return {
      ...baseThresholds,
      accelG: baseThresholds.accelG * profile.accelG,
      audioDb: baseThresholds.audioDb * profile.audioDb,
      gyroMagnitude: baseThresholds.gyroMagnitude * profile.gyroMagnitude,
      minSpeedBeforeKmh:
        baseThresholds.minSpeedBeforeKmh * profile.minSpeedBeforeKmh,
      orientationTiltDeg:
        baseThresholds.orientationTiltDeg * profile.orientationTiltDeg,
      speedDropPercent:
        baseThresholds.speedDropPercent * profile.speedDropPercent,
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

  evaluateSeverity(snapshot, thresholds) {
    const {accelG, speedDropPercent, orientationTiltDeg, gyroMag, audioDb} =
      snapshot;

    const accelScore = Math.min((accelG / thresholds.accelG) * 36, 36);
    const speedScore = Math.min(
      (speedDropPercent / thresholds.speedDropPercent) * 28,
      28,
    );
    const orientationScore = Math.min(
      (orientationTiltDeg / thresholds.orientationTiltDeg) * 22,
      22,
    );
    const gyroScore = Math.min((gyroMag / thresholds.gyroMagnitude) * 10, 10);
    const audioScore = Math.min((audioDb / 120) * 4, 4);

    const score = Math.round(
      Math.max(
        0,
        Math.min(
          accelScore + speedScore + orientationScore + gyroScore + audioScore,
          100,
        ),
      ),
    );

    let label = 'Low';
    if (score >= 80) {
      label = 'Critical';
    } else if (score >= 55) {
      label = 'Medium';
    }

    const reasons = [];
    if (accelG >= thresholds.accelG) {
      reasons.push('High impact force');
    }
    if (speedDropPercent >= thresholds.speedDropPercent) {
      reasons.push('Sudden speed drop');
    }
    if (orientationTiltDeg >= thresholds.orientationTiltDeg) {
      reasons.push('Abnormal tilt/orientation');
    }
    if (gyroMag >= thresholds.gyroMagnitude) {
      reasons.push('Rapid rotation');
    }
    if (audioDb >= thresholds.audioDb) {
      reasons.push('Impact audio spike');
    }

    return {
      label,
      score,
      reasons,
    };
  }

  buildSnapshot(sensorData, thresholds, options = {}) {
    const {ax, ay, az, gx, gy, gz, speed, db} = sensorData;
    const accelMag = calculateMagnitude(ax, ay, az);
    const accelG = accelMag / 9.81;
    const gyroMag = calculateMagnitude(gx, gy, gz);
    const speedBeforeKmh =
      Number(options.speedBeforeKmh) > 0
        ? Number(options.speedBeforeKmh)
        : this.lastSpeed;
    const speedAfterKmh = speed;
    const speedDropPercent =
      speedBeforeKmh > 0
        ? ((speedBeforeKmh - speedAfterKmh) / speedBeforeKmh) * 100
        : 0;
    const orientationTiltDeg = this.calculateTiltDeg(ax, ay, az);
    const audioDb = db;

    const signals = {
      abnormalOrientation: orientationTiltDeg >= thresholds.orientationTiltDeg,
      highImpact: accelG >= thresholds.accelG,
      suddenStop:
        speedBeforeKmh >= thresholds.minSpeedBeforeKmh &&
        speedDropPercent >= thresholds.speedDropPercent,
      rapidRotation: gyroMag >= thresholds.gyroMagnitude,
    };

    return {
      accelG: Number(accelG.toFixed(2)),
      accelMag: Number(accelMag.toFixed(2)),
      audioDb: Number(audioDb.toFixed(2)),
      gyroMag: Number(gyroMag.toFixed(2)),
      orientationTiltDeg: Number(orientationTiltDeg.toFixed(2)),
      speedAfterKmh: Number(speedAfterKmh.toFixed(2)),
      speedBeforeKmh: Number(speedBeforeKmh.toFixed(2)),
      speedDropPercent: Number(speedDropPercent.toFixed(2)),
      signals,
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

  check(sensorData) {
    if (this.cooldown) {
      return null;
    }

    const thresholds = this.getThresholds();
    const snapshot = this.buildSnapshot(sensorData, thresholds);
    this.lastSpeed = sensorData.speed;
    const severity = this.evaluateSeverity(snapshot, thresholds);

    const shouldTrigger =
      snapshot.signals.highImpact &&
      snapshot.signals.suddenStop &&
      snapshot.signals.abnormalOrientation;

    if (shouldTrigger) {
      this.cooldown = true;
      setTimeout(() => {
        this.cooldown = false;
      }, 30000);

      const payload = {
        detectedAt: new Date().toISOString(),
        severity,
        snapshot,
      };

      this.crashCallback?.(payload);
      return payload;
    }

    return null;
  }
}

export default new CrashDetectionService();
