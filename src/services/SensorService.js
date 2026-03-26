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
import {CRASH_THRESHOLDS} from '../utils/constants';
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

  monitoring = false;

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

  updateCallbacks({onSensorUpdate, onLocationUpdate, onCrash}) {
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
  }

  emitSensorUpdate() {
    this.onSensorUpdate?.({...this.currentData});
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

    this.accelSubscription = accelerometer.subscribe(({x, y, z}) => {
      this.currentData.ax = x;
      this.currentData.ay = y;
      this.currentData.az = z;
      this.emitSensorUpdate();
      this.evaluateCrash();
    });

    this.gyroSubscription = gyroscope.subscribe(({x, y, z}) => {
      this.currentData.gx = x;
      this.currentData.gy = y;
      this.currentData.gz = z;
      this.emitSensorUpdate();
      this.evaluateCrash();
    });

    LocationService.startWatching(async nextLocation => {
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

  async startBackgroundMonitoring() {
    if (!BackgroundActions.isRunning()) {
      await BackgroundActions.start(this.backgroundTask, backgroundOptions);
    }
  }

  async stopBackgroundMonitoring() {
    if (BackgroundActions.isRunning()) {
      await BackgroundActions.stop();
    }
  }

  async startMonitoring({
    mode = 'biker',
    onSensorUpdate,
    onLocationUpdate,
    onCrash,
  }) {
    this.updateCallbacks({onSensorUpdate, onLocationUpdate, onCrash});
    CrashDetectionService.setMode(mode);

    if (this.monitoring) {
      await this.startBackgroundMonitoring();
      this.emitSensorUpdate();
      return this.currentData;
    }

    this.monitoring = true;
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
    await this.startAudioMetering();
    await this.startBackgroundMonitoring();
    this.emitSensorUpdate();

    return this.currentData;
  }

  async stopMonitoring() {
    this.monitoring = false;
    this.unsubscribeSensors();
    CrashDetectionService.reset();
    await this.stopAudioMetering();
    await this.stopBackgroundMonitoring();
  }

  isMonitoring() {
    return this.monitoring;
  }

  simulateCrash(mode = 'biker') {
    const threshold = CRASH_THRESHOLDS[mode];
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
