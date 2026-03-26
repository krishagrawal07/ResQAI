import {PermissionsAndroid, Platform} from 'react-native';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

function isGranted(status) {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
}

export async function requestAllPermissions() {
  if (Platform.OS === 'android') {
    const requests = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ];

    if (Platform.Version >= 33) {
      requests.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    const results = await PermissionsAndroid.requestMultiple(requests);

    return {
      activity:
        results[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] ===
        PermissionsAndroid.RESULTS.GRANTED,
      backgroundLocation:
        results[PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED,
      location:
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED,
      microphone:
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
        PermissionsAndroid.RESULTS.GRANTED,
      notifications:
        Platform.Version < 33 ||
        results[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] ===
          PermissionsAndroid.RESULTS.GRANTED,
      phoneState:
        results[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ===
        PermissionsAndroid.RESULTS.GRANTED,
    };
  }

  const [always, whenInUse, microphone, motion] = await Promise.all([
    request(PERMISSIONS.IOS.LOCATION_ALWAYS),
    request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE),
    request(PERMISSIONS.IOS.MICROPHONE),
    request(PERMISSIONS.IOS.MOTION),
  ]);

  return {
    activity: isGranted(motion),
    backgroundLocation: isGranted(always),
    location: isGranted(whenInUse) || isGranted(always),
    microphone: isGranted(microphone),
    notifications: true,
    phoneState: true,
  };
}
