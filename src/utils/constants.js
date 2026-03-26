export const COLORS = {
  BG: '#080C14',
  BG2: '#0D1220',
  BG3: '#111827',
  CARD: '#0F172A',
  CYAN: '#00E5FF',
  PINK: '#FF3D6B',
  GREEN: '#00FF88',
  YELLOW: '#FFD600',
  MUTED: '#4B5680',
  MUTED2: '#7B85A8',
  TEXT: '#E2E8F5',
};

export const FONTS = {
  heading: 'monospace',
  mono: 'monospace',
};

export const CRASH_THRESHOLDS = {
  biker: {
    accelMagnitude: 20,
    gyroMagnitude: 150,
    speedDropPercent: 80,
    audioDb: 100,
  },
  car: {
    accelMagnitude: 25,
    gyroMagnitude: 120,
    speedDropPercent: 70,
    audioDb: 105,
  },
};

export const STORAGE_KEYS = {
  ONBOARDED: 'onboarded',
  USER_PROFILE: 'resqai_user_profile',
  LAST_LOCATION: 'resqai_last_location',
  LOCAL_CRASH_LOGS: 'resqai_local_crash_logs',
  LOCAL_FIREBASE_USER: 'resqai_local_firebase_user',
};

export const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export const LOCAL_POLICE_SMS_NUMBER = '+10000000000';

export const DARK_MAP_STYLE = [
  {elementType: 'geometry', stylers: [{color: '#0f172a'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#9ca3af'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#020617'}]},
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{color: '#e2e8f5'}],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{color: '#60a5fa'}],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: '#0b1324'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{color: '#1e293b'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{color: '#0b1220'}],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{color: '#94a3b8'}],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{color: '#111827'}],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{color: '#08111f'}],
  },
];

export const DISPATCH_DELAYS = [0, 1400, 2800, 4200];
