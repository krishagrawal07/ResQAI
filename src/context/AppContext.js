import React, {createContext, useContext, useMemo, useReducer} from 'react';
import {
  DEFAULT_EMERGENCY_PLAN,
  DEFAULT_PREFERENCES,
  DEFAULT_USER_PROFILE,
} from '../utils/constants';

const initialSensors = {
  ax: 0,
  ay: 0,
  az: 0,
  gx: 0,
  gy: 0,
  gz: 0,
  speed: 0,
  db: 0,
};

const initialState = {
  mode: 'biker',
  isMonitoring: false,
  sensors: initialSensors,
  crashDetected: false,
  crashMeta: null,
  sosTriggered: false,
  dispatchLog: [],
  activeIncident: null,
  userProfile: DEFAULT_USER_PROFILE,
  preferences: DEFAULT_PREFERENCES,
  emergencyPlan: DEFAULT_EMERGENCY_PLAN,
  runtime: {
    firebaseReady: false,
    sensorSource: 'idle',
    startupMode: 'ready',
    permissions: {
      activity: false,
      backgroundLocation: false,
      location: false,
      microphone: false,
      notifications: false,
      phoneState: false,
    },
  },
  location: {lat: 0, lng: 0, address: ''},
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        userProfile: {
          ...state.userProfile,
          vehicleMode: action.payload,
        },
      };
    case 'SET_MONITORING':
      return {
        ...state,
        isMonitoring: action.payload,
      };
    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };
    case 'SET_EMERGENCY_PLAN':
      return {
        ...state,
        emergencyPlan: {
          ...state.emergencyPlan,
          ...action.payload,
        },
      };
    case 'SET_RUNTIME_STATUS':
      return {
        ...state,
        runtime: {
          ...state.runtime,
          ...action.payload,
          permissions: {
            ...state.runtime.permissions,
            ...(action.payload?.permissions ?? {}),
          },
        },
      };
    case 'UPDATE_SENSORS':
      return {
        ...state,
        sensors: {
          ...state.sensors,
          ...action.payload,
        },
      };
    case 'CRASH_DETECTED':
      return {
        ...state,
        crashDetected: true,
        crashMeta: action.payload ?? state.crashMeta,
      };
    case 'SOS_TRIGGERED':
      return {
        ...state,
        crashDetected: false,
        sosTriggered: true,
        dispatchLog: [],
      };
    case 'ADD_DISPATCH_LOG':
      return {
        ...state,
        dispatchLog: [...state.dispatchLog, action.payload],
      };
    case 'SET_ACTIVE_INCIDENT':
      return {
        ...state,
        activeIncident: {
          ...(state.activeIncident ?? {}),
          ...(action.payload ?? {}),
        },
      };
    case 'SET_LOCATION':
      return {
        ...state,
        location: {
          ...state.location,
          ...action.payload,
        },
      };
    case 'RESET_CRASH':
      return {
        ...state,
        crashDetected: false,
        crashMeta: null,
        sosTriggered: false,
        dispatchLog: [],
        activeIncident: null,
        sensors: initialSensors,
      };
    case 'SET_USER_PROFILE':
      return {
        ...state,
        userProfile: {
          ...DEFAULT_USER_PROFILE,
          ...state.userProfile,
          ...action.payload,
          emergencyContact: {
            ...DEFAULT_USER_PROFILE.emergencyContact,
            ...state.userProfile.emergencyContact,
            ...(action.payload?.emergencyContact ?? {}),
          },
        },
        mode: action.payload?.vehicleMode ?? state.mode,
      };
    default:
      return state;
  }
}

const AppContext = createContext({
  state: initialState,
  dispatch: () => undefined,
});

export function AppProvider({children}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({state, dispatch}), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}

export {initialSensors, initialState};
