import {AccessibilityInfo, Vibration} from 'react-native';
import Sound from 'react-native-sound';

const ALARM_SOUND = require('../assets/sounds/resq_alarm.wav');

class NotificationService {
  alarm = null;
  softTone = null;

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

  loadSoftTone() {
    return new Promise(resolve => {
      if (this.softTone?.isLoaded()) {
        resolve(this.softTone);
        return;
      }

      this.softTone = new Sound(ALARM_SOUND, error => {
        if (error) {
          console.log('Soft alert tone load failed', error);
          resolve(null);
          return;
        }

        this.softTone.setVolume(0.18);
        this.softTone.setNumberOfLoops(0);
        resolve(this.softTone);
      });
    });
  }

  hapticImpact(intensity = 'light') {
    const durationMap = {
      light: 18,
      medium: 32,
      heavy: 48,
    };

    Vibration.vibrate(durationMap[intensity] ?? durationMap.light);
  }

  hapticAlert() {
    Vibration.vibrate([0, 80, 40, 120], false);
  }

  async playSoftAlertTone({volume = 0.18} = {}) {
    const tone = await this.loadSoftTone();

    if (!tone) {
      return;
    }

    tone.setVolume(volume);
    tone.setNumberOfLoops(0);
    tone.stop(() => {
      tone.play();
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

    if (this.softTone) {
      this.softTone.release();
      this.softTone = null;
    }
  }
}

export default new NotificationService();
