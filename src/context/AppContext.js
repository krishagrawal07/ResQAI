import React, {createContext, useContext, useMemo, useReducer} from 'react';

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
  sosTriggered: false,
  dispatchLog: [],
  userProfile: {
    name: '',
    phone: '',
    emergencyContact: {name: '', phone: ''},
    vehicleMode: 'biker',
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
        sosTriggered: false,
        dispatchLog: [],
        sensors: initialSensors,
      };
    case 'SET_USER_PROFILE':
      return {
        ...state,
        userProfile: {
          ...state.userProfile,
          ...action.payload,
          emergencyContact: {
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
