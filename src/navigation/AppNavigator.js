import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
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
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SafetyScreen from '../screens/SafetyScreen';
import {COLORS, FONTS} from '../utils/constants';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabBarIcon({routeName, focused, color, size}) {
  const focusAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: focused ? 1 : 0,
      tension: 120,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [focusAnim, focused]);

  const iconMap = {
    Monitor: focused ? 'pulse' : 'pulse-outline',
    Dispatch: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
    Insights: focused ? 'analytics' : 'analytics-outline',
    Contacts: focused ? 'call' : 'call-outline',
    Safety: focused ? 'options' : 'options-outline',
    Profile: focused ? 'person-circle' : 'person-circle-outline',
  };
  const toneMap = {
    Dispatch: [COLORS.GREEN, COLORS.CYAN],
    Insights: [COLORS.BLUE, COLORS.CYAN],
    Contacts: [COLORS.PINK, COLORS.ORANGE],
    Monitor: [COLORS.CYAN, COLORS.BLUE],
    Profile: [COLORS.PINK, COLORS.ORANGE],
    Safety: [COLORS.YELLOW, COLORS.ORANGE],
  };
  const tones = toneMap[routeName] ?? [COLORS.CYAN, COLORS.BLUE];
  const animatedOrbStyle = {
    transform: [
      {
        scale: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        }),
      },
      {
        translateY: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -1.5],
        }),
      },
    ],
  };
  const animatedMutedStyle = {
    opacity: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.45],
    }),
    transform: [
      {
        scale: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.94],
        }),
      },
    ],
  };

  if (focused) {
    return (
      <Animated.View style={animatedOrbStyle}>
        <LinearGradient
          colors={tones}
          end={{x: 1, y: 1}}
          start={{x: 0, y: 0}}
          style={styles.tabOrb}>
          <Ionicons
            color={COLORS.BG}
            name={iconMap[routeName]}
            size={size - 1}
          />
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedMutedStyle}>
      <View style={styles.tabOrbMuted}>
        <Ionicons color={color} name={iconMap[routeName]} size={size - 1} />
      </View>
    </Animated.View>
  );
}

function getTabScreenOptions(routeName, title = routeName) {
  return {
    title,
    tabBarIcon: props => <TabBarIcon routeName={routeName} {...props} />,
  };
}

function TabBarBackground() {
  return (
    <LinearGradient
      colors={['rgba(20, 34, 56, 0.94)', 'rgba(14, 25, 44, 0.86)']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.tabBarBackground}
    />
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 26,
          height: 76,
          paddingBottom: 10,
          paddingTop: 10,
          overflow: 'hidden',
          elevation: 0,
          shadowColor: COLORS.CYAN,
          shadowOffset: {width: 0, height: 8},
          shadowOpacity: 0.22,
          shadowRadius: 16,
        },
        tabBarBackground: TabBarBackground,
        tabBarActiveTintColor: COLORS.TEXT,
        tabBarInactiveTintColor: COLORS.MUTED2,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          marginTop: 4,
          letterSpacing: 0.2,
          fontFamily: FONTS.strong,
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
        name="Insights"
        component={HowItWorksScreen}
        options={getTabScreenOptions('Insights')}
      />
      <Tab.Screen
        name="Safety"
        component={SafetyScreen}
        options={getTabScreenOptions('Safety')}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={getTabScreenOptions('Contacts')}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.CYAN,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 6,
  },
  tabOrbMuted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(151, 166, 199, 0.28)',
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(151, 166, 199, 0.2)',
  },
});
