import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  FIREBASE_API_KEY,
  FIREBASE_APP_ID,
  FIREBASE_PROJECT_ID,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_STORAGE_BUCKET,
} from '@env';
import {STORAGE_KEYS} from '../utils/constants';
import {calculateMagnitude} from '../utils/helpers';

class FirebaseService {
  initializationPromise = null;

  buildFirebaseOptions() {
    if (
      !FIREBASE_APP_ID ||
      FIREBASE_APP_ID === 'your_app_id_here' ||
      !FIREBASE_PROJECT_ID
    ) {
      return null;
    }

    return {
      appId: FIREBASE_APP_ID,
      apiKey: FIREBASE_API_KEY,
      projectId: FIREBASE_PROJECT_ID,
      messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    };
  }

  hasNativeFirebaseApp() {
    try {
      return firebase.apps.length > 0;
    } catch (error) {
      return false;
    }
  }

  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        if (firebase.apps.length > 0) {
          return firebase.app();
        }

        const options = this.buildFirebaseOptions();

        if (options) {
          return firebase.initializeApp(options, 'ResQAI');
        }
      } catch (error) {
        console.log('Firebase initialization skipped', error);
      }

      return null;
    })();

    return this.initializationPromise;
  }

  async getLocalUserId() {
    const existing = await AsyncStorage.getItem(
      STORAGE_KEYS.LOCAL_FIREBASE_USER,
    );

    if (existing) {
      return existing;
    }

    const nextId = `local-${Date.now()}`;
    await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_FIREBASE_USER, nextId);
    return nextId;
  }

  async signInAnonymously() {
    await this.initialize();

    try {
      const credential = await auth().signInAnonymously();
      const uid = credential?.user?.uid;

      if (uid) {
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_FIREBASE_USER, uid);
      }

      return credential?.user ?? null;
    } catch (error) {
      console.log('Anonymous auth fallback', error);
      return {uid: await this.getLocalUserId()};
    }
  }

  getCurrentUserId() {
    try {
      return auth().currentUser?.uid ?? null;
    } catch (error) {
      return null;
    }
  }

  async saveUserProfile(userId, profile) {
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_PROFILE,
      JSON.stringify(profile),
    );

    try {
      await this.initialize();

      if (this.hasNativeFirebaseApp()) {
        await firestore()
          .collection('users')
          .doc(userId)
          .set(profile, {merge: true});
      }
    } catch (error) {
      console.log('saveUserProfile fallback', error);
    }

    return profile;
  }

  async getUserProfile(userId) {
    try {
      await this.initialize();

      if (this.hasNativeFirebaseApp()) {
        const document = await firestore()
          .collection('users')
          .doc(userId)
          .get();
        if (document.exists()) {
          return document.data();
        }
      }
    } catch (error) {
      console.log('getUserProfile fallback', error);
    }

    const localProfile = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return localProfile ? JSON.parse(localProfile) : null;
  }

  async logCrashEvent(sensors, location, userId = null) {
    const payload = {
      userId:
        userId ?? this.getCurrentUserId() ?? (await this.getLocalUserId()),
      timestamp: new Date().toISOString(),
      location: {
        lat: location.lat,
        lng: location.lng,
        address: location.address,
      },
      sensors: {
        accelMag: calculateMagnitude(sensors.ax, sensors.ay, sensors.az),
        gyroMag: calculateMagnitude(sensors.gx, sensors.gy, sensors.gz),
        speed: sensors.speed,
        db: sensors.db,
      },
      status: 'SOS_TRIGGERED',
    };

    const currentLogsRaw = await AsyncStorage.getItem(
      STORAGE_KEYS.LOCAL_CRASH_LOGS,
    );
    const currentLogs = currentLogsRaw ? JSON.parse(currentLogsRaw) : [];
    const localId = `local-crash-${Date.now()}`;
    const localPayload = {id: localId, ...payload};
    await AsyncStorage.setItem(
      STORAGE_KEYS.LOCAL_CRASH_LOGS,
      JSON.stringify([localPayload, ...currentLogs]),
    );

    try {
      await this.initialize();

      if (this.hasNativeFirebaseApp()) {
        const document = await firestore().collection('crashes').add({
          userId: payload.userId,
          timestamp: firestore.FieldValue.serverTimestamp(),
          location: payload.location,
          sensors: payload.sensors,
          status: payload.status,
        });

        return {id: document.id, ...payload, source: 'firestore'};
      }
    } catch (error) {
      console.log('logCrashEvent fallback', error);
    }

    return {...localPayload, source: 'local'};
  }

  async updateCrashStatus(crashId, status) {
    try {
      await this.initialize();

      if (this.hasNativeFirebaseApp()) {
        await firestore().collection('crashes').doc(crashId).update({status});
      }
    } catch (error) {
      console.log('updateCrashStatus fallback', error);
    }

    const currentLogsRaw = await AsyncStorage.getItem(
      STORAGE_KEYS.LOCAL_CRASH_LOGS,
    );
    const currentLogs = currentLogsRaw ? JSON.parse(currentLogsRaw) : [];
    const nextLogs = currentLogs.map(entry =>
      entry.id === crashId ? {...entry, status} : entry,
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.LOCAL_CRASH_LOGS,
      JSON.stringify(nextLogs),
    );
  }
}

export default new FirebaseService();
