import {CRASH_THRESHOLDS} from '../utils/constants';
import {calculateMagnitude} from '../utils/helpers';

class CrashDetectionService {
  mode = 'biker';

  lastSpeed = 0;

  crashCallback = null;

  cooldown = false;

  setMode(mode) {
    this.mode = mode;
  }

  setCallback(callback) {
    this.crashCallback = callback;
  }

  reset() {
    this.lastSpeed = 0;
    this.cooldown = false;
  }

  check(sensorData) {
    if (this.cooldown) {
      return null;
    }

    const {ax, ay, az, gx, gy, gz, speed, db} = sensorData;
    const thresholds = CRASH_THRESHOLDS[this.mode];
    const accelMag = calculateMagnitude(ax, ay, az);
    const gyroMag = calculateMagnitude(gx, gy, gz);
    const speedThreshold = 1 - thresholds.speedDropPercent / 100;
    const speedDrop =
      this.lastSpeed > 10 &&
      speed < this.lastSpeed * Math.max(speedThreshold, 0.1);

    this.lastSpeed = speed;

    const signals = [
      accelMag > thresholds.accelMagnitude,
      gyroMag > thresholds.gyroMagnitude,
      speedDrop,
      db > thresholds.audioDb,
    ];

    const confirmedCount = signals.filter(Boolean).length;

    if (confirmedCount >= 2) {
      this.cooldown = true;
      setTimeout(() => {
        this.cooldown = false;
      }, 30000);

      const payload = {
        accelMag,
        gyroMag,
        speedDrop,
        confirmedCount,
        db,
      };

      this.crashCallback?.(payload);
      return payload;
    }

    return null;
  }
}

export default new CrashDetectionService();
