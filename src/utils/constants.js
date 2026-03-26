export const COLORS = {
  BG: '#050816',
  BG2: '#0B1120',
  BG3: '#111B32',
  CARD: '#10192B',
  CARD_ALT: '#16243D',
  SURFACE: '#1A2946',
  CYAN: '#59D8FF',
  PINK: '#FF5C8A',
  GREEN: '#4CF2B4',
  YELLOW: '#FFD166',
  ORANGE: '#FF9B71',
  BLUE: '#7AA2FF',
  RED: '#FF6B6B',
  MUTED: '#40547C',
  MUTED2: '#97A6C7',
  TEXT: '#F4F7FB',
  TEXT_DIM: '#C3CCE1',
  BORDER: 'rgba(137, 159, 208, 0.18)',
};

export const FONTS = {
  heading: 'System',
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
  scooter: {
    accelMagnitude: 18,
    gyroMagnitude: 140,
    speedDropPercent: 78,
    audioDb: 98,
  },
  family: {
    accelMagnitude: 28,
    gyroMagnitude: 110,
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
  autoArm: true,
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
