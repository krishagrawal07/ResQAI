import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import MonitorScreen from '../screens/MonitorScreen';
import DispatchScreen from '../screens/DispatchScreen';
import HowItWorksScreen from '../screens/HowItWorksScreen';
import {COLORS} from '../utils/constants';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabBarIcon({routeName, focused, color, size}) {
  const iconMap = {
    Monitor: focused ? 'radio' : 'radio-outline',
    Dispatch: focused ? 'alert-circle' : 'alert-circle-outline',
    HowItWorks: 'information-circle-outline',
  };

  return <Ionicons color={color} name={iconMap[routeName]} size={size} />;
}

function getTabScreenOptions(routeName, title = routeName) {
  return {
    title,
    tabBarIcon: props => <TabBarIcon routeName={routeName} {...props} />,
  };
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: COLORS.BG2,
          borderTopColor: 'rgba(0,229,255,0.1)',
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.CYAN,
        tabBarInactiveTintColor: COLORS.MUTED,
      }}>
      <Tab.Screen
        name="Monitor"
        component={MonitorScreen}
        options={getTabScreenOptions('Monitor')}
      />
      <Tab.Screen
        name="Dispatch"
        component={DispatchScreen}
        options={getTabScreenOptions('Dispatch')}
      />
      <Tab.Screen
        name="HowItWorks"
        component={HowItWorksScreen}
        options={getTabScreenOptions('HowItWorks', 'How It Works')}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{headerShown: false}}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
    </Stack.Navigator>
  );
}
