import {Vibration} from 'react-native';
import Sound from 'react-native-sound';

const ALARM_SOUND = require('../assets/sounds/resq_alarm.wav');

class NotificationService {
  alarm = null;

  configure() {
    try {
      Sound.setCategory('Playback', true);
      Sound.setActive(true);
    } catch (error) {
      console.log('NotificationService.configure', error);
    }
  }

  loadAlarm() {
    return new Promise(resolve => {
      if (this.alarm?.isLoaded()) {
        resolve(this.alarm);
        return;
      }

      this.alarm = new Sound(ALARM_SOUND, error => {
        if (error) {
          console.log('Alarm sound load failed', error);
          resolve(null);
          return;
        }

        this.alarm.setVolume(1);
        this.alarm.setNumberOfLoops(-1);
        resolve(this.alarm);
      });
    });
  }

  async playAlarm() {
    const alarm = await this.loadAlarm();
    Vibration.vibrate([0, 400, 250], true);

    if (alarm) {
      alarm.stop(() => {
        alarm.play();
      });
    }
  }

  async triggerCrashAlarm() {
    await this.playAlarm();
  }

  stopAlarm() {
    Vibration.cancel();

    if (this.alarm) {
      this.alarm.stop();
    }
  }

  release() {
    this.stopAlarm();

    if (this.alarm) {
      this.alarm.release();
      this.alarm = null;
    }
  }
}

export default new NotificationService();
