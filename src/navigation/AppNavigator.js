import React from 'react';
import {StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import MonitorScreen from '../screens/MonitorScreen';
import DispatchScreen from '../screens/DispatchScreen';
import HowItWorksScreen from '../screens/HowItWorksScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SafetyScreen from '../screens/SafetyScreen';
import {COLORS} from '../utils/constants';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabBarIcon({routeName, focused, color, size}) {
  const iconMap = {
    Monitor: focused ? 'pulse' : 'pulse-outline',
    Dispatch: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
    Safety: focused ? 'options' : 'options-outline',
    Insights: focused ? 'analytics' : 'analytics-outline',
    Profile: focused ? 'person-circle' : 'person-circle-outline',
  };
  const toneMap = {
    Dispatch: [COLORS.GREEN, COLORS.CYAN],
    Insights: [COLORS.BLUE, COLORS.CYAN],
    Monitor: [COLORS.CYAN, COLORS.BLUE],
    Profile: [COLORS.PINK, COLORS.ORANGE],
    Safety: [COLORS.YELLOW, COLORS.ORANGE],
  };
  const tones = toneMap[routeName] ?? [COLORS.CYAN, COLORS.BLUE];

  if (focused) {
    return (
      <LinearGradient
        colors={tones}
        end={{x: 1, y: 1}}
        start={{x: 0, y: 0}}
        style={styles.tabOrb}>
        <Ionicons color={COLORS.BG} name={iconMap[routeName]} size={size - 1} />
      </LinearGradient>
    );
  }

  return (
    <View style={styles.tabOrbMuted}>
      <Ionicons color={color} name={iconMap[routeName]} size={size - 1} />
    </View>
  );
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
          backgroundColor: COLORS.CARD,
          borderTopColor: COLORS.BORDER,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 12,
          paddingTop: 12,
        },
        tabBarActiveTintColor: COLORS.CYAN,
        tabBarInactiveTintColor: COLORS.MUTED,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 3,
        },
        tabBarItemStyle: {
          paddingVertical: 3,
        },
      }}>
      <Tab.Screen
        name="Monitor"
        component={MonitorScreen}
        options={getTabScreenOptions('Monitor', 'Protect')}
      />
      <Tab.Screen
        name="Dispatch"
        component={DispatchScreen}
        options={getTabScreenOptions('Dispatch', 'Rescue')}
      />
      <Tab.Screen
        name="Safety"
        component={SafetyScreen}
        options={getTabScreenOptions('Safety')}
      />
      <Tab.Screen
        name="Insights"
        component={HowItWorksScreen}
        options={getTabScreenOptions('Insights')}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={getTabScreenOptions('Profile')}
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

const styles = StyleSheet.create({
  tabOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.CYAN,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  tabOrbMuted: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
});
