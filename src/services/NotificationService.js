import {AccessibilityInfo, Vibration} from 'react-native';
import {Audio, InterruptionModeAndroid, InterruptionModeIOS} from 'expo-av';
import * as Haptics from 'expo-haptics';

const ALARM_SOUND = require('../assets/sounds/resq_alarm.wav');

const IMPACT_STYLE = {
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
};

class NotificationService {
  alarm = null;

  softTone = null;

  async configure() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
      });
    } catch (error) {
      console.log('NotificationService.configure', error);
    }
  }

  async loadAlarm() {
    if (this.alarm) {
      return this.alarm;
    }

    try {
      const {sound} = await Audio.Sound.createAsync(ALARM_SOUND, {
        isLooping: true,
        shouldPlay: false,
        volume: 1,
      });
      this.alarm = sound;
      return this.alarm;
    } catch (error) {
      console.log('Alarm sound load failed', error);
      return null;
    }
  }

  async loadSoftTone() {
    if (this.softTone) {
      return this.softTone;
    }

    try {
      const {sound} = await Audio.Sound.createAsync(ALARM_SOUND, {
        isLooping: false,
        shouldPlay: false,
        volume: 0.18,
      });
      this.softTone = sound;
      return this.softTone;
    } catch (error) {
      console.log('Soft alert tone load failed', error);
      return null;
    }
  }

  async hapticImpact(intensity = 'light') {
    try {
      await Haptics.impactAsync(IMPACT_STYLE[intensity] ?? IMPACT_STYLE.light);
    } catch (error) {
      const durationMap = {
        light: 18,
        medium: 32,
        heavy: 48,
      };
      Vibration.vibrate(durationMap[intensity] ?? durationMap.light);
    }
  }

  async hapticAlert() {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      // Vibration gives Android and older devices a dependable fallback.
    }
    Vibration.vibrate([0, 80, 40, 120], false);
  }

  async playSoftAlertTone({volume = 0.18} = {}) {
    try {
      const tone = await this.loadSoftTone();

      if (!tone) {
        return;
      }

      await tone.setVolumeAsync(volume);
      await tone.setIsLoopingAsync(false);
      await tone.setPositionAsync(0);
      await tone.playAsync();
    } catch (error) {
      console.log('Soft alert tone play failed', error);
    }
  }

  async playAlarm({silentDispatch = false} = {}) {
    if (silentDispatch) {
      Vibration.vibrate(150);
    } else {
      Vibration.vibrate([0, 400, 250], true);
    }

    const alarm = await this.loadAlarm();

    if (!alarm) {
      return;
    }

    try {
      await alarm.setVolumeAsync(silentDispatch ? 0.45 : 1);
      await alarm.setIsLoopingAsync(!silentDispatch);
      await alarm.setPositionAsync(0);
      await alarm.playAsync();
    } catch (error) {
      console.log('Alarm sound play failed', error);
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
      this.alarm.stopAsync().catch(error => {
        console.log('Alarm stop failed', error);
      });
    }
  }

  release() {
    this.stopAlarm();

    if (this.alarm) {
      this.alarm.unloadAsync().catch(error => {
        console.log('Alarm unload failed', error);
      });
      this.alarm = null;
    }

    if (this.softTone) {
      this.softTone.unloadAsync().catch(error => {
        console.log('Soft tone unload failed', error);
      });
      this.softTone = null;
    }
  }
}

export default new NotificationService();
