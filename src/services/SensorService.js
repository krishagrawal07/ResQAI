import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import BackgroundActions from 'react-native-background-actions';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import {
  accelerometer,
  gyroscope,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import CrashDetectionService from './CrashDetectionService';
import LocationService from './LocationService';
import {
  CRASH_SCORING,
  CRASH_THRESHOLDS,
  STORAGE_KEYS,
} from '../utils/constants';
import {calculateMagnitude} from '../utils/helpers';

const GRAVITY_MS2 = 9.80665;
const RAD_TO_DEG = 180 / Math.PI;
const BACKGROUND_SENSOR_TASK = 'resqai-background-sensor-heartbeat';
const SENSOR_UPDATE_MS = 100;
const UI_TELEMETRY_THROTTLE_MS = 250;
const STREAM_STALE_MS = 8000;
const RECOVERY_COOLDOWN_MS = 12000;
const SHAKE_WINDOW_MS = 1100;
const SHAKE_COOLDOWN_MS = 8000;
const SHAKE_MIN_EVENTS = 3;
const SHAKE_MAGNITUDE_G = 2.1;
const SHAKE_DELTA_G = 0.7;

const backgroundOptions = {
  taskName: 'ResQAI Monitor',
  taskTitle: 'ResQ AI Active',
  taskDesc: 'Monitoring accelerometer, gyroscope, and GPS for crashes...',
  taskIcon: {name: 'ic_launcher', type: 'mipmap'},
  color: '#FF3B30',
  linkingURI: 'resqai://monitor',
};

function createEmptySensorData() {
  return {
    ax: 0,
    ay: 0,
    az: 0,
    gx: 0,
    gy: 0,
    gz: 0,
    speed: 0,
    speedBeforeKmh: 0,
    speedDropKmh: 0,
    speedDropPercent: 0,
    accelG: 0,
    gyroMag: 0,
    orientationTiltDeg: 0,
    crashScore: 0,
    shakeCount: 0,
    db: 0,
    sensorSampleAt: 0,
    speedSampleAt: 0,
  };
}

function removeSubscription(subscription) {
  if (!subscription) {
    return;
  }

  if (typeof subscription.remove === 'function') {
    subscription.remove();
    return;
  }

  subscription.unsubscribe?.();
}

function normaliseAccelG(value = 0) {
  return Platform.OS === 'android' ? value / GRAVITY_MS2 : value;
}

function normaliseAccelMs2(value = 0) {
  return Platform.OS === 'android' ? value : value * GRAVITY_MS2;
}

if (!TaskManager.isTaskDefined(BACKGROUND_SENSOR_TASK)) {
  TaskManager.defineTask(BACKGROUND_SENSOR_TASK, async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.BACKGROUND_HEARTBEAT,
        JSON.stringify({
          heartbeatAt: new Date().toISOString(),
          source: 'expo-background-fetch',
        }),
      );
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      console.log('Background sensor heartbeat error', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

class SensorService {
  accelSubscription = null;

  gyroSubscription = null;

  monitoring = false;

  lastLiveEventAt = 0;

  lastTelemetryPublishedAt = 0;

  lastAccelMagnitudeG = 1;

  lastShakeAt = 0;

  shakeEvents = [];

  sensorSource = 'idle';

  onStatusChange = null;

  currentData = createEmptySensorData();

  onSensorUpdate = null;

  onLocationUpdate = null;

  onCrash = null;

  onShake = null;

  appState = 'active';

  lastRecoveryAt = 0;

  recoveryPromise = null;

  backgroundTask = async () => {
    while (BackgroundActions.isRunning()) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      await this.ensureContinuousMonitoring('foreground-service');
      await BackgroundActions.updateNotification({
        taskDesc: `Monitoring ${
          CrashDetectionService.mode
        } mode - score ${Math.round(this.currentData.crashScore)}`,
      });
    }
  };

  getLatestSampleAt() {
    return Math.max(
      Number(this.currentData.sensorSampleAt) || 0,
      Number(this.currentData.speedSampleAt) || 0,
      this.lastLiveEventAt || 0,
    );
  }

  hasSensorSubscriptions() {
    return Boolean(this.accelSubscription && this.gyroSubscription);
  }

  async persistMonitoringSession(mode = CrashDetectionService.mode) {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.MONITORING_SESSION,
        JSON.stringify({
          active: true,
          mode,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.log('Monitoring session persist failed', error);
    }
  }

  async clearMonitoringSession() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.MONITORING_SESSION);
    } catch (error) {
      console.log('Monitoring session clear failed', error);
    }
  }

  updateCallbacks({
    onSensorUpdate,
    onLocationUpdate,
    onCrash,
    onShake,
    onStatusChange,
  }) {
    if (onSensorUpdate) {
      this.onSensorUpdate = onSensorUpdate;
    }

    if (onLocationUpdate) {
      this.onLocationUpdate = onLocationUpdate;
    }

    if (onCrash) {
      this.onCrash = onCrash;
      CrashDetectionService.setCallback(onCrash);
    }

    if (onShake) {
      this.onShake = onShake;
    }

    if (onStatusChange) {
      this.onStatusChange = onStatusChange;
    }
  }

  setSensorSource(nextSource) {
    if (this.sensorSource === nextSource) {
      return;
    }

    this.sensorSource = nextSource;
    this.onStatusChange?.({sensorSource: nextSource});
  }

  markLiveEvent() {
    this.lastLiveEventAt = Date.now();
    this.setSensorSource('live');
  }

  applyCrashPreview() {
    const preview = CrashDetectionService.previewSeverity(this.currentData);

    this.currentData = {
      ...this.currentData,
      accelG: preview.snapshot.accelG,
      crashScore: preview.severity.score,
      gyroMag: preview.snapshot.gyroMag,
      orientationTiltDeg: preview.snapshot.orientationTiltDeg,
      speedDropKmh: preview.snapshot.speedDropKmh,
      speedDropPercent: preview.snapshot.speedDropPercent,
    };
  }

  publishTelemetry({force = false} = {}) {
    this.applyCrashPreview();

    if (this.monitoring) {
      const crashPayload = CrashDetectionService.check(this.currentData);
      if (crashPayload) {
        force = true;
      }
    }

    const now = Date.now();

    if (
      !force &&
      now - this.lastTelemetryPublishedAt < UI_TELEMETRY_THROTTLE_MS
    ) {
      return;
    }

    this.lastTelemetryPublishedAt = now;
    this.onSensorUpdate?.({...this.currentData});
  }

  detectShake(rawAccelG) {
    if (!this.monitoring) {
      return;
    }

    const now = Date.now();
    const magnitudeG = calculateMagnitude(
      rawAccelG.x,
      rawAccelG.y,
      rawAccelG.z,
    );
    const deltaG = Math.abs(magnitudeG - this.lastAccelMagnitudeG);
    this.lastAccelMagnitudeG = magnitudeG;

    if (magnitudeG < SHAKE_MAGNITUDE_G || deltaG < SHAKE_DELTA_G) {
      return;
    }

    this.shakeEvents = this.shakeEvents.filter(
      timestamp => now - timestamp <= SHAKE_WINDOW_MS,
    );
    this.shakeEvents.push(now);
    this.currentData.shakeCount = this.shakeEvents.length;

    if (
      this.shakeEvents.length >= SHAKE_MIN_EVENTS &&
      now - this.lastShakeAt > SHAKE_COOLDOWN_MS
    ) {
      this.lastShakeAt = now;
      this.shakeEvents = [];
      this.onShake?.({
        detectedAt: new Date(now).toISOString(),
        magnitudeG: Number(magnitudeG.toFixed(2)),
        source: 'accelerometer-shake',
      });
    }
  }

  async subscribeSensors() {
    try {
      setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_UPDATE_MS);
      this.accelSubscription = accelerometer.subscribe(
        ({x, y, z}) => {
          const accelG = {
            x: normaliseAccelG(x),
            y: normaliseAccelG(y),
            z: normaliseAccelG(z),
          };

          this.currentData.sensorSampleAt = Date.now();
          this.markLiveEvent();
          this.detectShake(accelG);
          this.currentData.ax = Number(normaliseAccelMs2(x).toFixed(2));
          this.currentData.ay = Number(normaliseAccelMs2(y).toFixed(2));
          this.currentData.az = Number(normaliseAccelMs2(z).toFixed(2));
          this.publishTelemetry();
        },
        error => {
          console.log('React Native accelerometer unavailable', error);
          removeSubscription(this.accelSubscription);
          this.accelSubscription = null;
          this.onStatusChange?.({accelerometerAvailable: false});
        },
      );
    } catch (error) {
      console.log('React Native accelerometer unavailable', error);
      this.onStatusChange?.({accelerometerAvailable: false});
    }

    try {
      setUpdateIntervalForType(SensorTypes.gyroscope, SENSOR_UPDATE_MS);
      this.gyroSubscription = gyroscope.subscribe(
        ({x, y, z}) => {
          this.currentData.sensorSampleAt = Date.now();
          this.markLiveEvent();
          this.currentData.gx = Number((x * RAD_TO_DEG).toFixed(2));
          this.currentData.gy = Number((y * RAD_TO_DEG).toFixed(2));
          this.currentData.gz = Number((z * RAD_TO_DEG).toFixed(2));
          this.publishTelemetry();
        },
        error => {
          console.log('React Native gyroscope unavailable', error);
          removeSubscription(this.gyroSubscription);
          this.gyroSubscription = null;
          this.onStatusChange?.({gyroscopeAvailable: false});
        },
      );
    } catch (error) {
      console.log('React Native gyroscope unavailable', error);
      this.onStatusChange?.({gyroscopeAvailable: false});
    }

    try {
      await LocationService.startWatching(
        nextLocation => {
          this.markLiveEvent();
          this.currentData.speed = nextLocation.speed;
          this.currentData.speedBeforeKmh = nextLocation.speedBeforeKmh;
          this.currentData.speedDropKmh = nextLocation.speedDropKmh;
          this.currentData.speedDropPercent = nextLocation.speedDropPercent;
          this.currentData.speedSampleAt = nextLocation.timestamp || Date.now();
          this.publishTelemetry({force: true});
          this.onLocationUpdate?.(nextLocation);
        },
        {intervalMs: 3500, distanceMeters: 1},
      );
    } catch (error) {
      console.log('Expo location watch unavailable', error);
      this.onStatusChange?.({locationAvailable: false});
    }
  }

  async unsubscribeSensors() {
    removeSubscription(this.accelSubscription);
    removeSubscription(this.gyroSubscription);
    this.accelSubscription = null;
    this.gyroSubscription = null;
    await LocationService.stopWatching();
  }

  async registerBackgroundFetch() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
        this.onStatusChange?.({permissions: {backgroundFetch: false}});
        return false;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_SENSOR_TASK,
      );

      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SENSOR_TASK, {
          minimumInterval: 60,
          startOnBoot: true,
          stopOnTerminate: false,
        });
      }

      this.onStatusChange?.({permissions: {backgroundFetch: true}});
      return true;
    } catch (error) {
      console.log('Background fetch registration unavailable', error);
      this.onStatusChange?.({permissions: {backgroundFetch: false}});
      return false;
    }
  }

  async unregisterBackgroundFetch() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_SENSOR_TASK,
      );

      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SENSOR_TASK);
      }
    } catch (error) {
      console.log('Background fetch unregister unavailable', error);
    }
  }

  async startAndroidForegroundService() {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      if (!BackgroundActions.isRunning()) {
        await BackgroundActions.start(this.backgroundTask, backgroundOptions);
      }
    } catch (error) {
      console.log('Android foreground monitor unavailable', error);
    }
  }

  async ensureBackgroundExecution() {
    await this.registerBackgroundFetch();

    if (Platform.OS === 'android') {
      await this.startAndroidForegroundService();
    }
  }

  async recoverSensorStreams(reason = 'sensor-recovery') {
    if (!this.monitoring) {
      return;
    }

    const now = Date.now();

    if (
      this.recoveryPromise ||
      now - this.lastRecoveryAt < RECOVERY_COOLDOWN_MS
    ) {
      return this.recoveryPromise;
    }

    this.lastRecoveryAt = now;
    this.recoveryPromise = (async () => {
      try {
        console.log('Recovering sensor streams', reason);
        await this.unsubscribeSensors();
        await this.subscribeSensors();
        this.publishTelemetry({force: true});
      } catch (error) {
        console.log('Sensor stream recovery failed', error);
      } finally {
        this.recoveryPromise = null;
      }
    })();

    return this.recoveryPromise;
  }

  async ensureContinuousMonitoring(reason = 'lifecycle') {
    if (!this.monitoring) {
      return;
    }

    await this.ensureBackgroundExecution();

    if (Platform.OS !== 'android') {
      return;
    }

    const latestSampleAt = this.getLatestSampleAt();
    const streamLooksStale =
      latestSampleAt > 0 && Date.now() - latestSampleAt > STREAM_STALE_MS;

    if (!this.hasSensorSubscriptions() || streamLooksStale) {
      await this.recoverSensorStreams(reason);
    }
  }

  handleAppStateChange(nextAppState) {
    this.appState = nextAppState;

    if (!this.monitoring) {
      return;
    }

    if (nextAppState === 'active') {
      this.ensureContinuousMonitoring('app-active').catch(error => {
        console.log('Continuous monitoring resume failed', error);
      });
      return;
    }

    if (Platform.OS === 'android') {
      this.ensureBackgroundExecution().catch(error => {
        console.log('Background execution handoff failed', error);
      });
    }
  }

  async stopAndroidForegroundService() {
    try {
      if (BackgroundActions.isRunning()) {
        await BackgroundActions.stop();
      }
    } catch (error) {
      console.log('Android foreground monitor stop', error);
    }
  }

  async startBackgroundMonitoring() {
    const backgroundLocationStarted =
      await LocationService.startBackgroundLocationUpdates(nextLocation => {
        this.currentData.speed = nextLocation.speed;
        this.currentData.speedBeforeKmh = nextLocation.speedBeforeKmh;
        this.currentData.speedDropKmh = nextLocation.speedDropKmh;
        this.currentData.speedDropPercent = nextLocation.speedDropPercent;
        this.currentData.speedSampleAt = nextLocation.timestamp || Date.now();
        this.publishTelemetry({force: true});
        this.onLocationUpdate?.(nextLocation);
      }).catch(error => {
        console.log('Background location unavailable', error);
        return false;
      });

    await this.ensureBackgroundExecution();
    this.onStatusChange?.({
      permissions: {backgroundLocation: backgroundLocationStarted},
    });
  }

  async stopBackgroundMonitoring() {
    await LocationService.stopBackgroundLocationUpdates().catch(error => {
      console.log('Background location stop unavailable', error);
    });
    await this.unregisterBackgroundFetch();
    await this.stopAndroidForegroundService();
  }

  async startMonitoring({
    mode = 'biker',
    onSensorUpdate,
    onLocationUpdate,
    onCrash,
    onShake,
    onStatusChange,
  }) {
    this.updateCallbacks({
      onSensorUpdate,
      onLocationUpdate,
      onCrash,
      onShake,
      onStatusChange,
    });
    CrashDetectionService.setMode(mode);

    if (this.monitoring) {
      await this.persistMonitoringSession(mode);
      await this.ensureContinuousMonitoring('refresh-start-monitoring');
      this.publishTelemetry({force: true});
      return this.currentData;
    }

    this.monitoring = true;
    this.lastLiveEventAt = 0;
    this.lastTelemetryPublishedAt = 0;
    this.lastAccelMagnitudeG = 1;
    this.lastShakeAt = 0;
    this.shakeEvents = [];
    this.setSensorSource('arming');
    this.currentData = createEmptySensorData();

    await this.subscribeSensors();
    await this.startBackgroundMonitoring();
    await this.persistMonitoringSession(mode);
    this.publishTelemetry({force: true});

    return this.currentData;
  }

  async stopMonitoring() {
    const wasMonitoring = this.monitoring;

    if (
      !wasMonitoring &&
      !this.hasSensorSubscriptions() &&
      !BackgroundActions.isRunning()
    ) {
      this.setSensorSource('idle');
      return;
    }

    this.monitoring = false;
    await this.unsubscribeSensors();
    this.lastTelemetryPublishedAt = 0;
    CrashDetectionService.reset();
    this.setSensorSource('idle');
    await this.stopBackgroundMonitoring();
    await this.clearMonitoringSession();
  }

  isMonitoring() {
    return this.monitoring;
  }

  simulateCrash(mode = 'biker') {
    const threshold = CRASH_THRESHOLDS[mode] ?? CRASH_THRESHOLDS.biker;
    const speedDropKmh = CRASH_SCORING.suddenSpeedDropThresholdKmh + 14;
    const speedBeforeKmh = Math.max(
      threshold.minSpeedBeforeKmh + 18,
      speedDropKmh + 10,
    );
    CrashDetectionService.setMode(mode);
    this.setSensorSource('drill');
    this.currentData = {
      ...createEmptySensorData(),
      ax: 22,
      ay: 16,
      az: 9,
      gx: threshold.gyroMagnitude,
      gy: threshold.gyroMagnitude * 0.76,
      gz: threshold.gyroMagnitude * 0.58,
      speed: speedBeforeKmh - speedDropKmh,
      speedBeforeKmh,
      speedDropKmh,
      speedDropPercent: Number(
        ((speedDropKmh / speedBeforeKmh) * 100).toFixed(2),
      ),
      sensorSampleAt: Date.now(),
      speedSampleAt: Date.now(),
    };
    this.applyCrashPreview();
    this.onSensorUpdate?.({...this.currentData});
    return {...this.currentData};
  }
}

const sensorService = new SensorService();

export async function startBackgroundMonitoring(options) {
  return sensorService.startMonitoring(options);
}

export async function stopBackgroundMonitoring() {
  return sensorService.stopMonitoring();
}

export default sensorService;
