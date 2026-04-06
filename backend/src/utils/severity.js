import {clamp} from './geo.js';

const MODE_THRESHOLDS = {
  biker: {
    accelG: 3.2,
    orientationTiltDeg: 50,
    speedDropPercent: 65,
    gyroDegPerSec: 120,
  },
  scooter: {
    accelG: 3.0,
    orientationTiltDeg: 50,
    speedDropPercent: 62,
    gyroDegPerSec: 115,
  },
  car: {
    accelG: 3.8,
    orientationTiltDeg: 58,
    speedDropPercent: 58,
    gyroDegPerSec: 95,
  },
  family: {
    accelG: 4.0,
    orientationTiltDeg: 58,
    speedDropPercent: 55,
    gyroDegPerSec: 90,
  },
};

const DEFAULT_THRESHOLDS = MODE_THRESHOLDS.biker;

function normalizeAgainstThreshold(value, threshold) {
  if (!threshold) {
    return 0;
  }

  return clamp(value / threshold, 0, 1.7);
}

export function classifySeverity(score) {
  if (score >= 80) {
    return 'Critical';
  }

  if (score >= 55) {
    return 'Medium';
  }

  return 'Low';
}

export function evaluateSeverity(snapshot = {}, mode = 'biker') {
  const thresholds = MODE_THRESHOLDS[mode] ?? DEFAULT_THRESHOLDS;
  const accelG = Number(snapshot.accelG || snapshot.accelMagG || 0);
  const speedBefore = Number(
    snapshot.speedBeforeKmh || snapshot.speedBefore || 0,
  );
  const speedAfter = Number(snapshot.speedKmh || snapshot.speed || 0);
  const speedDropPercent =
    speedBefore > 0 ? ((speedBefore - speedAfter) / speedBefore) * 100 : 0;
  const orientationTiltDeg = Number(snapshot.orientationTiltDeg || 0);
  const gyroDegPerSec = Number(snapshot.gyroMag || snapshot.gyroDegPerSec || 0);
  const audioDb = Number(snapshot.audioDb || snapshot.db || 0);

  const accelComponent =
    normalizeAgainstThreshold(accelG, thresholds.accelG) * 36;
  const speedComponent =
    normalizeAgainstThreshold(speedDropPercent, thresholds.speedDropPercent) *
    28;
  const orientationComponent =
    normalizeAgainstThreshold(
      orientationTiltDeg,
      thresholds.orientationTiltDeg,
    ) * 22;
  const gyroComponent =
    normalizeAgainstThreshold(gyroDegPerSec, thresholds.gyroDegPerSec) * 10;
  const audioComponent = clamp(audioDb / 125, 0, 1) * 4;

  const rawScore =
    accelComponent +
    speedComponent +
    orientationComponent +
    gyroComponent +
    audioComponent;
  const score = Math.round(clamp(rawScore, 0, 100));

  const reasons = [];
  if (accelG >= thresholds.accelG) {
    reasons.push('High impact force detected');
  }
  if (speedDropPercent >= thresholds.speedDropPercent) {
    reasons.push('Sudden speed drop detected');
  }
  if (orientationTiltDeg >= thresholds.orientationTiltDeg) {
    reasons.push('Abnormal orientation detected');
  }
  if (gyroDegPerSec >= thresholds.gyroDegPerSec) {
    reasons.push('Rapid rotational change detected');
  }
  if (audioDb >= 95) {
    reasons.push('Loud impact audio spike observed');
  }

  const severity = classifySeverity(score);

  return {
    label: severity,
    score,
    reasons,
    metrics: {
      accelG,
      audioDb,
      gyroDegPerSec,
      orientationTiltDeg,
      speedAfter,
      speedBefore,
      speedDropPercent: Number(speedDropPercent.toFixed(2)),
    },
    thresholds,
  };
}
