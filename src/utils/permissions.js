import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import {Accelerometer, Gyroscope} from 'expo-sensors';
import * as SMS from 'expo-sms';
import {Linking, PermissionsAndroid, Platform} from 'react-native';

function isAndroidAtLeast(version) {
  return Platform.OS === 'android' && Number(Platform.Version) >= version;
}

async function requestAndroidPermission(permission, options = {}) {
  const minimumVersion = options.minimumVersion ?? 0;

  if (Platform.OS !== 'android' || Number(Platform.Version) < minimumVersion) {
    return true;
  }

  try {
    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    return false;
  }
}

async function requestSensorPermission(sensor) {
  try {
    const isAvailable =
      typeof sensor.isAvailableAsync === 'function'
        ? await sensor.isAvailableAsync()
        : true;

    if (!isAvailable) {
      return false;
    }

    if (typeof sensor.getPermissionsAsync !== 'function') {
      return true;
    }

    let permission = await sensor.getPermissionsAsync();
    if (
      !permission.granted &&
      typeof sensor.requestPermissionsAsync === 'function'
    ) {
      permission = await sensor.requestPermissionsAsync();
    }

    return Boolean(permission.granted);
  } catch (error) {
    return false;
  }
}

export async function requestLocationAlwaysPermission() {
  let foreground = await Location.getForegroundPermissionsAsync().catch(
    () => null,
  );
  if (!foreground?.granted) {
    foreground = await Location.requestForegroundPermissionsAsync().catch(
      () => null,
    );
  }

  let background = await Location.getBackgroundPermissionsAsync().catch(
    () => null,
  );
  if (foreground?.granted && !background?.granted) {
    background = await Location.requestBackgroundPermissionsAsync().catch(
      () => null,
    );
  }

  return {
    backgroundLocation: Boolean(background?.granted),
    location: Boolean(foreground?.granted),
  };
}

export async function requestActivityRecognitionPermission() {
  const [accelerometerGranted, gyroscopeGranted, recognitionGranted] =
    await Promise.all([
      requestSensorPermission(Accelerometer),
      requestSensorPermission(Gyroscope),
      requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        {
          minimumVersion: 29,
        },
      ),
    ]);

  return Boolean(
    accelerometerGranted && gyroscopeGranted && recognitionGranted,
  );
}

export async function requestSmsPermission() {
  const [smsAvailable, smsGranted] = await Promise.all([
    SMS.isAvailableAsync().catch(() => false),
    requestAndroidPermission(PermissionsAndroid.PERMISSIONS.SEND_SMS, {
      minimumVersion: 23,
    }),
  ]);

  return Boolean(smsAvailable && smsGranted);
}

export async function requestPhoneCallPermission() {
  const [canDial, callPermissionGranted] = await Promise.all([
    Linking.canOpenURL('tel:112').catch(() => false),
    requestAndroidPermission(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
      minimumVersion: 23,
    }),
  ]);

  return Boolean(canDial && callPermissionGranted);
}

export async function requestNotificationPermission() {
  return requestAndroidPermission(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    {
      minimumVersion: 33,
    },
  );
}

export async function requestCommunicationPermissions() {
  const [sms, phoneCall] = await Promise.all([
    requestSmsPermission(),
    requestPhoneCallPermission(),
  ]);

  return {
    phoneCall,
    sms,
  };
}

export async function requestAllPermissions() {
  const [
    location,
    activity,
    notifications,
    communicationPermissions,
    backgroundFetchStatus,
  ] = await Promise.all([
    requestLocationAlwaysPermission(),
    requestActivityRecognitionPermission(),
    requestNotificationPermission().catch(() => false),
    requestCommunicationPermissions(),
    BackgroundFetch.getStatusAsync().catch(() => null),
  ]);

  return {
    activity,
    backgroundFetch:
      backgroundFetchStatus === BackgroundFetch.BackgroundFetchStatus.Available,
    backgroundLocation: location.backgroundLocation,
    location: location.location,
    microphone: true,
    notifications: Boolean(notifications),
    phoneCall: communicationPermissions.phoneCall,
    sms: communicationPermissions.sms,
  };
}

export function hasFullMonitoringPermissions(permissions = {}) {
  const hasAlwaysLocation =
    Boolean(permissions.location) && Boolean(permissions.backgroundLocation);

  return hasAlwaysLocation && Boolean(permissions.activity);
}

export function hasEmergencyCommunicationPermissions(permissions = {}) {
  return Boolean(permissions.sms) && Boolean(permissions.phoneCall);
}

export function requiresAndroidActivityPermission() {
  return isAndroidAtLeast(29);
}
