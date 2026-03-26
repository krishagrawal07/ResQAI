/**
 * @format
 */

import 'react-native';
import React from 'react';
import {it} from '@jest/globals';
import renderer from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-navigation/native', () => ({
  DarkTheme: {colors: {}},
  NavigationContainer: ({children}) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}) => children,
}));

jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

jest.mock('../src/navigation/AppNavigator', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/services/FirebaseService', () => ({
  initialize: jest.fn(async () => null),
}));

jest.mock('../src/services/NotificationService', () => ({
  configure: jest.fn(),
  release: jest.fn(),
}));

jest.mock('../src/services/SensorService', () => ({
  stopMonitoring: jest.fn(),
}));

import App from '../App';

it('renders correctly', async () => {
  let tree;

  await renderer.act(async () => {
    tree = renderer.create(<App />);
    await Promise.resolve();
  });

  expect(tree).toBeTruthy();
});
