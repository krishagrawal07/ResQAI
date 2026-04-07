import {Platform} from 'react-native';

export const COLORS = {
  PRIMARY: '#FF3B30',
  ACCENT: '#0A84FF',
  SUCCESS: '#34C759',
  BG: '#0D0D0D',
  BG2: '#151515',
  BG3: '#1C1C1E',
  CARD: '#161618',
  CARD_ALT: '#202024',
  SURFACE: '#2A2A2E',
  CYAN: '#0A84FF',
  PINK: '#FF3B30',
  GREEN: '#34C759',
  YELLOW: '#FFD60A',
  ORANGE: '#FF9F0A',
  BLUE: '#0A84FF',
  RED: '#FF3B30',
  MUTED: '#5F5F66',
  MUTED2: '#A1A1AA',
  TEXT: '#F5F5F7',
  TEXT_DIM: '#D1D1D6',
  BORDER: 'rgba(255, 255, 255, 0.12)',
};

export const FONTS = {
  heading: Platform.select({
    ios: 'AvenirNext-Bold',
    android: 'sans-serif-condensed',
    default: 'System',
  }),
  body: Platform.select({
    ios: 'AvenirNext-Regular',
    android: 'sans-serif',
    default: 'System',
  }),
  strong: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

export const CRASH_THRESHOLDS = {
  biker: {
    accelG: 3.2,
    accelMagnitude: 20,
    orientationTiltDeg: 50,
    gyroMagnitude: 150,
    minSpeedBeforeKmh: 28,
    speedDropPercent: 80,
    audioDb: 100,
  },
  car: {
    accelG: 3.8,
    accelMagnitude: 25,
    orientationTiltDeg: 58,
    gyroMagnitude: 120,
    minSpeedBeforeKmh: 30,
    speedDropPercent: 70,
    audioDb: 105,
  },
  scooter: {
    accelG: 3.0,
    accelMagnitude: 18,
    orientationTiltDeg: 50,
    gyroMagnitude: 140,
    minSpeedBeforeKmh: 24,
    speedDropPercent: 78,
    audioDb: 98,
  },
  family: {
    accelG: 4.0,
    accelMagnitude: 28,
    orientationTiltDeg: 58,
    gyroMagnitude: 110,
    minSpeedBeforeKmh: 32,
    speedDropPercent: 65,
    audioDb: 108,
  },
};

export const MODE_META = {
  biker: {
    value: 'biker',
    label: 'Bike',
    fullLabel: 'Biker Shield',
    subtitle: 'Fast two-wheel response',
    icon: 'bicycle-outline',
    accent: COLORS.CYAN,
  },
  scooter: {
    value: 'scooter',
    label: 'Scooter',
    fullLabel: 'Scooter Commute',
    subtitle: 'City ride and delivery trips',
    icon: 'flash-outline',
    accent: COLORS.YELLOW,
  },
  car: {
    value: 'car',
    label: 'Car',
    fullLabel: 'City Car',
    subtitle: 'Private car and cab tuning',
    icon: 'car-sport-outline',
    accent: COLORS.GREEN,
  },
  family: {
    value: 'family',
    label: 'SUV / Van',
    fullLabel: 'Family Drive',
    subtitle: 'Heavy vehicle safety profile',
    icon: 'bus-outline',
    accent: COLORS.PINK,
  },
};

export const SENSITIVITY_OPTIONS = [
  {
    value: 'calm',
    label: 'Calm',
    subtitle: 'Fewer alerts on smooth daily travel',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    subtitle: 'Recommended blend of speed and caution',
  },
  {
    value: 'max',
    label: 'Max',
    subtitle: 'Most sensitive protection for high-risk trips',
  },
];

export const DEFAULT_USER_PROFILE = {
  name: '',
  phone: '',
  city: '',
  bloodGroup: 'Unknown',
  vehicleId: '',
  medicalNotes: '',
  emergencyContact: {name: '', phone: ''},
  vehicleMode: 'biker',
};

export const DEFAULT_PREFERENCES = {
  detectionSensitivity: 'balanced',
  autoArm: false,
  guardianMode: true,
  voicePrompts: true,
  silentDispatch: false,
  shareMedicalCard: true,
  notifyNearbyResponders: true,
};

export const DEFAULT_EMERGENCY_PLAN = {
  bloodGroup: 'Unknown',
  medicalNotes: 'No medical notes added yet.',
  safeWord: 'ResQ',
  roadsidePlan: 'Nearest responders + emergency contact',
};

export const STORAGE_KEYS = {
  ONBOARDED: 'onboarded',
  USER_PROFILE: 'resqai_user_profile',
  APP_PREFERENCES: 'resqai_app_preferences',
  EMERGENCY_PLAN: 'resqai_emergency_plan',
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
  {elementType: 'geometry', stylers: [{color: '#111111'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#A1A1AA'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#050505'}]},
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{color: '#F5F5F7'}],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{color: '#0A84FF'}],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: '#121A14'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{color: '#242428'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{color: '#080808'}],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{color: '#A1A1AA'}],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{color: '#1C1C1E'}],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{color: '#071421'}],
  },
];

export const DISPATCH_DELAYS = [0, 1400, 2800, 4200];
