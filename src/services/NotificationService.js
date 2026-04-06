import {AccessibilityInfo, Vibration} from 'react-native';
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

  async playAlarm({silentDispatch = false} = {}) {
    const alarm = await this.loadAlarm();
    if (silentDispatch) {
      Vibration.vibrate(150);
    } else {
      Vibration.vibrate([0, 400, 250], true);
    }

    if (alarm) {
      alarm.setVolume(silentDispatch ? 0.45 : 1);
      alarm.setNumberOfLoops(silentDispatch ? 0 : -1);
      alarm.stop(() => {
        alarm.play();
      });
    }
  }

  async triggerCrashAlarm(options = {}) {
    await this.playAlarm(options);
  }

  announcePrompt(message) {
    if (!message) {
      return;
    }

    try {
      AccessibilityInfo.announceForAccessibility(message);
    } catch (error) {
      console.log('NotificationService.announcePrompt', error);
    }
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
