import {Platform} from 'react-native';
import BackgroundActions from 'react-native-background-actions';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  accelerometer,
  gyroscope,
  SensorTypes,
  setUpdateIntervalForType,
} from 'react-native-sensors';
import CrashDetectionService from './CrashDetectionService';
import LocationService from './LocationService';
import {CRASH_THRESHOLDS, DEFAULT_REGION} from '../utils/constants';
import {normaliseDecibel} from '../utils/helpers';

const backgroundOptions = {
  taskName: 'ResQAI Monitor',
  taskTitle: 'ResQ AI Active',
  taskDesc: 'Monitoring for accidents...',
  taskIcon: {name: 'ic_launcher', type: 'mipmap'},
  color: '#00E5FF',
  linkingURI: 'resqai://monitor',
};

class SensorService {
  audioRecorderPlayer = new AudioRecorderPlayer();

  accelSubscription = null;

  gyroSubscription = null;

  demoInterval = null;

  monitoring = false;

  lastLiveEventAt = 0;

  sensorSource = 'idle';

  onStatusChange = null;

  currentData = {
    ax: 0,
    ay: 0,
    az: 0,
    gx: 0,
    gy: 0,
    gz: 0,
    speed: 0,
    db: 0,
  };

  onSensorUpdate = null;

  onLocationUpdate = null;

  onCrash = null;

  backgroundTask = async () => {
    await new Promise(async resolve => {
      while (BackgroundActions.isRunning()) {
        await new Promise(r => setTimeout(r, 2500));
        await BackgroundActions.updateNotification({
          taskDesc: `Monitoring ${CrashDetectionService.mode} mode...`,
        });
      }
      resolve();
    });
  };

  updateCallbacks({onSensorUpdate, onLocationUpdate, onCrash, onStatusChange}) {
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

    if (onStatusChange) {
      this.onStatusChange = onStatusChange;
    }
  }

  emitSensorUpdate() {
    this.onSensorUpdate?.({...this.currentData});
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

  evaluateCrash() {
    if (!this.monitoring) {
      return;
    }

    CrashDetectionService.check(this.currentData);
  }

  async startAudioMetering() {
    try {
      this.audioRecorderPlayer.setSubscriptionDuration(0.1);
      await this.audioRecorderPlayer.startRecorder(
        Platform.select({
          ios: 'resqai-monitor.m4a',
          android: undefined,
        }),
        undefined,
        true,
      );
      this.audioRecorderPlayer.addRecordBackListener(event => {
        this.currentData.db = normaliseDecibel(event.currentMetering);
        this.emitSensorUpdate();
        this.evaluateCrash();
      });
    } catch (error) {
      console.log('Audio metering unavailable', error);
    }
  }

  async stopAudioMetering() {
    try {
      this.audioRecorderPlayer.removeRecordBackListener();
      await this.audioRecorderPlayer.stopRecorder();
    } catch (error) {
      console.log('Audio metering stop', error);
    }
  }

  subscribeSensors() {
    setUpdateIntervalForType(SensorTypes.accelerometer, 100);
    setUpdateIntervalForType(SensorTypes.gyroscope, 100);

    try {
      this.accelSubscription = accelerometer.subscribe(({x, y, z}) => {
        this.markLiveEvent();
        this.currentData.ax = x;
        this.currentData.ay = y;
        this.currentData.az = z;
        this.emitSensorUpdate();
        this.evaluateCrash();
      });
    } catch (error) {
      console.log('Accelerometer unavailable', error);
    }

    try {
      this.gyroSubscription = gyroscope.subscribe(({x, y, z}) => {
        this.markLiveEvent();
        this.currentData.gx = x;
        this.currentData.gy = y;
        this.currentData.gz = z;
        this.emitSensorUpdate();
        this.evaluateCrash();
      });
    } catch (error) {
      console.log('Gyroscope unavailable', error);
    }

    LocationService.startWatching(async nextLocation => {
      this.markLiveEvent();
      this.currentData.speed = nextLocation.speed;
      this.emitSensorUpdate();
      this.evaluateCrash();
      this.onLocationUpdate?.({
        lat: nextLocation.lat,
        lng: nextLocation.lng,
      });
    });
  }

  unsubscribeSensors() {
    this.accelSubscription?.unsubscribe();
    this.gyroSubscription?.unsubscribe();
    this.accelSubscription = null;
    this.gyroSubscription = null;
    LocationService.stopWatching();
  }

  startDemoLoop(mode = 'biker') {
    this.stopDemoLoop();

    this.demoInterval = setInterval(() => {
      if (!this.monitoring) {
        return;
      }

      if (Date.now() - this.lastLiveEventAt <= 1600) {
        return;
      }

      const phase = Date.now() / 850;
      const threshold = CRASH_THRESHOLDS[mode] ?? CRASH_THRESHOLDS.biker;
      const motionScale = mode === 'family' ? 0.75 : mode === 'car' ? 0.9 : 1;

      this.setSensorSource('preview');
      this.currentData = {
        ...this.currentData,
        ax: Number((Math.sin(phase) * 1.8 * motionScale).toFixed(2)),
        ay: Number((Math.cos(phase * 1.3) * 1.5 * motionScale).toFixed(2)),
        az: Number((9.6 + Math.sin(phase * 0.5) * 0.4).toFixed(2)),
        gx: Number((Math.sin(phase * 0.8) * 24 * motionScale).toFixed(2)),
        gy: Number((Math.cos(phase * 0.9) * 18 * motionScale).toFixed(2)),
        gz: Number((Math.sin(phase * 1.1) * 12 * motionScale).toFixed(2)),
        speed: Number(
          Math.max(
            6,
            26 + Math.sin(phase * 0.7) * 8 + (mode === 'scooter' ? 4 : 0),
          ).toFixed(2),
        ),
        db: Number(
          Math.min(
            threshold.audioDb - 18,
            46 + Math.abs(Math.cos(phase * 1.2)) * 12,
          ).toFixed(2),
        ),
      };

      this.emitSensorUpdate();
      this.onLocationUpdate?.({
        lat: DEFAULT_REGION.latitude + Math.sin(phase / 4) * 0.0018,
        lng: DEFAULT_REGION.longitude + Math.cos(phase / 4) * 0.0018,
        address: 'Smart preview route',
      });
    }, 1200);
  }

  stopDemoLoop() {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
  }

  async startBackgroundMonitoring() {
    try {
      if (!BackgroundActions.isRunning()) {
        await BackgroundActions.start(this.backgroundTask, backgroundOptions);
      }
    } catch (error) {
      console.log('Background monitor unavailable', error);
    }
  }

  async stopBackgroundMonitoring() {
    try {
      if (BackgroundActions.isRunning()) {
        await BackgroundActions.stop();
      }
    } catch (error) {
      console.log('Background monitor stop', error);
    }
  }

  async startMonitoring({
    mode = 'biker',
    onSensorUpdate,
    onLocationUpdate,
    onCrash,
    onStatusChange,
  }) {
    this.updateCallbacks({
      onSensorUpdate,
      onLocationUpdate,
      onCrash,
      onStatusChange,
    });
    CrashDetectionService.setMode(mode);

    if (this.monitoring) {
      await this.startBackgroundMonitoring();
      this.emitSensorUpdate();
      return this.currentData;
    }

    this.monitoring = true;
    this.lastLiveEventAt = 0;
    this.setSensorSource('preview');
    this.currentData = {
      ax: 0,
      ay: 0,
      az: 0,
      gx: 0,
      gy: 0,
      gz: 0,
      speed: 0,
      db: 0,
    };

    this.subscribeSensors();
    this.startDemoLoop(mode);
    await this.startAudioMetering();
    await this.startBackgroundMonitoring();
    this.emitSensorUpdate();

    return this.currentData;
  }

  async stopMonitoring() {
    this.monitoring = false;
    this.stopDemoLoop();
    this.unsubscribeSensors();
    CrashDetectionService.reset();
    this.setSensorSource('idle');
    await this.stopAudioMetering();
    await this.stopBackgroundMonitoring();
  }

  isMonitoring() {
    return this.monitoring;
  }

  simulateCrash(mode = 'biker') {
    const threshold = CRASH_THRESHOLDS[mode] ?? CRASH_THRESHOLDS.biker;
    this.setSensorSource('preview');
    this.currentData = {
      ax: threshold.accelMagnitude * 0.95,
      ay: threshold.accelMagnitude * 0.88,
      az: threshold.accelMagnitude * 1.1,
      gx: threshold.gyroMagnitude * 0.92,
      gy: threshold.gyroMagnitude * 0.87,
      gz: threshold.gyroMagnitude * 1.03,
      speed: 4,
      db: threshold.audioDb + 8,
    };
    this.emitSensorUpdate();
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
