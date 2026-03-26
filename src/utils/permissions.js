import {PermissionsAndroid, Platform} from 'react-native';
import {request, PERMISSIONS} from 'react-native-permissions';

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

    await PermissionsAndroid.requestMultiple(requests);
    return;
  }

  await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
  await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
  await request(PERMISSIONS.IOS.MICROPHONE);
  await request(PERMISSIONS.IOS.MOTION);
}
