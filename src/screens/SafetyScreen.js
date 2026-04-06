import React, {useEffect, useState} from 'react';
import {
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AuroraBackground from '../components/AuroraBackground';
import RevealView from '../components/RevealView';
import {useAppContext} from '../context/AppContext';
import {
  COLORS,
  FONTS,
  SENSITIVITY_OPTIONS,
  STORAGE_KEYS,
} from '../utils/constants';

const TOGGLES = [
  {
    key: 'guardianMode',
    icon: 'people-outline',
    title: 'Guardian mode',
    subtitle: 'Push updates to your chosen emergency contact faster',
  },
  {
    key: 'autoArm',
    icon: 'shield-outline',
    title: 'Auto arm on launch',
    subtitle: 'Keep your preferred monitoring profile ready each time',
  },
  {
    key: 'voicePrompts',
    icon: 'volume-high-outline',
    title: 'Voice prompts',
    subtitle: 'Use spoken countdown cues during rescue confirmation',
  },
  {
    key: 'shareMedicalCard',
    icon: 'medkit-outline',
    title: 'Share medical card',
    subtitle: 'Include blood group and notes in the rescue payload',
  },
  {
    key: 'notifyNearbyResponders',
    icon: 'radio-outline',
    title: 'Nearby responder ping',
    subtitle: 'Add community help points to the dispatch list',
  },
  {
    key: 'silentDispatch',
    icon: 'moon-outline',
    title: 'Silent dispatch',
    subtitle: 'Skip loud prompts after the first crash warning',
  },
];

const EMERGENCY_NUMBERS = [
  {label: 'National emergency', value: '112'},
  {label: 'Ambulance / medical', value: '108'},
  {label: 'Police desk', value: '100'},
];

export default function SafetyScreen() {
  const {
    state: {preferences, emergencyPlan},
    dispatch,
  } = useAppContext();
  const [planDraft, setPlanDraft] = useState(emergencyPlan);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlanDraft(emergencyPlan);
  }, [emergencyPlan]);

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handleToggle = async key => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const nextPreferences = {[key]: !preferences[key]};
      dispatch({type: 'SET_PREFERENCES', payload: nextPreferences});
      await AsyncStorage.setItem(
        STORAGE_KEYS.APP_PREFERENCES,
        JSON.stringify({...preferences, ...nextPreferences}),
      );
    } catch (error) {
      Alert.alert('Update failed', 'Unable to save this setting right now.');
    }
  };

  const handleSensitivityChange = async nextValue => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      dispatch({
        type: 'SET_PREFERENCES',
        payload: {detectionSensitivity: nextValue},
      });
      await AsyncStorage.setItem(
        STORAGE_KEYS.APP_PREFERENCES,
        JSON.stringify({...preferences, detectionSensitivity: nextValue}),
      );
    } catch (error) {
      Alert.alert(
        'Update failed',
        'Unable to update crash sensitivity right now.',
      );
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    try {
      dispatch({type: 'SET_EMERGENCY_PLAN', payload: planDraft});
      await AsyncStorage.setItem(
        STORAGE_KEYS.EMERGENCY_PLAN,
        JSON.stringify(planDraft),
      );
      Alert.alert('Saved', 'Emergency card updated successfully.');
    } catch (error) {
      Alert.alert('Save failed', 'Unable to save your emergency card.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickDial = async phone => {
    const dialUrl = `tel:${phone}`;
    try {
      const canOpen = await Linking.canOpenURL(dialUrl);
      if (!canOpen) {
        Alert.alert('Dial unavailable', `Calling ${phone} is not supported.`);
        return;
      }
      await Linking.openURL(dialUrl);
    } catch (error) {
      Alert.alert('Dial failed', `Unable to start the call to ${phone}.`);
    }
  };

  return (
    <View style={styles.container}>
      <AuroraBackground variant="safety" />

      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.scrollBody}>
        <RevealView delay={40}>
          <LinearGradient
            colors={['rgba(16, 25, 43, 0.95)', 'rgba(22, 36, 61, 0.8)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.hero}>
            <View style={styles.heroBadge}>
              <Ionicons
                color={COLORS.YELLOW}
                name="options-outline"
                size={18}
              />
              <Text style={styles.heroBadgeText}>Safety command center</Text>
            </View>
            <Text style={styles.heroTitle}>Control how protection behaves</Text>
            <Text style={styles.heroCopy}>
              Tune alert sensitivity, guardian behavior, and the emergency card
              that gets shared during a real rescue event.
            </Text>
          </LinearGradient>
        </RevealView>

        <RevealView delay={100}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Protection switches</Text>
            <Text style={styles.sectionCaption}>
              The settings that shape your response flow
            </Text>
          </View>

          <View style={styles.card}>
            {TOGGLES.map((item, index) => {
              const enabled = Boolean(preferences[item.key]);

              return (
                <RevealView delay={index * 50} key={item.key}>
                  <View
                    style={[
                      styles.toggleRow,
                      enabled ? styles.toggleRowActive : styles.toggleRowMuted,
                    ]}>
                    <View style={styles.toggleCopy}>
                      <View style={styles.toggleTitleRow}>
                        <Ionicons
                          color={enabled ? COLORS.CYAN : COLORS.MUTED2}
                          name={item.icon}
                          size={18}
                        />
                        <Text style={styles.toggleTitle}>{item.title}</Text>
                      </View>
                      <Text style={styles.toggleSubtitle}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.toggleAction}>
                      <Text
                        style={[
                          styles.toggleState,
                          enabled
                            ? styles.toggleStateActive
                            : styles.toggleStateMuted,
                        ]}>
                        {enabled ? 'On' : 'Off'}
                      </Text>
                      <Switch
                        onValueChange={() => handleToggle(item.key)}
                        thumbColor={enabled ? COLORS.CYAN : '#E5E7EB'}
                        trackColor={{
                          false: 'rgba(151, 166, 199, 0.35)',
                          true: 'rgba(89, 216, 255, 0.4)',
                        }}
                        value={enabled}
                      />
                    </View>
                  </View>
                </RevealView>
              );
            })}
          </View>
        </RevealView>

        <RevealView delay={160}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Detection sensitivity</Text>
            <Text style={styles.sectionCaption}>
              Choose how cautious the crash model should feel
            </Text>
          </View>

          <View style={styles.pillRow}>
            {SENSITIVITY_OPTIONS.map((option, index) => {
              const selected =
                preferences.detectionSensitivity === option.value;

              return (
                <RevealView delay={index * 60} key={option.value}>
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => handleSensitivityChange(option.value)}
                    style={[
                      styles.sensitivityPill,
                      selected ? styles.sensitivityPillActive : null,
                    ]}>
                    <Text
                      style={[
                        styles.sensitivityTitle,
                        selected ? styles.sensitivityTitleActive : null,
                      ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.sensitivitySubtitle}>
                      {option.subtitle}
                    </Text>
                  </TouchableOpacity>
                </RevealView>
              );
            })}
          </View>
        </RevealView>

        <RevealView delay={220}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency card</Text>
            <Text style={styles.sectionCaption}>
              This gets bundled into your rescue plan
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>Blood group</Text>
            <TextInput
              onChangeText={text =>
                setPlanDraft(current => ({...current, bloodGroup: text}))
              }
              placeholder="A+, O-, B+..."
              placeholderTextColor={COLORS.MUTED}
              style={styles.input}
              value={planDraft.bloodGroup}
            />

            <Text style={styles.inputLabel}>Medical notes</Text>
            <TextInput
              multiline
              onChangeText={text =>
                setPlanDraft(current => ({...current, medicalNotes: text}))
              }
              placeholder="Allergies, medication, implant info..."
              placeholderTextColor={COLORS.MUTED}
              style={[styles.input, styles.multilineInput]}
              textAlignVertical="top"
              value={planDraft.medicalNotes}
            />

            <Text style={styles.inputLabel}>Safe word</Text>
            <TextInput
              onChangeText={text =>
                setPlanDraft(current => ({...current, safeWord: text}))
              }
              placeholder="Shared family phrase"
              placeholderTextColor={COLORS.MUTED}
              style={styles.input}
              value={planDraft.safeWord}
            />

            <Text style={styles.inputLabel}>Roadside plan</Text>
            <TextInput
              onChangeText={text =>
                setPlanDraft(current => ({...current, roadsidePlan: text}))
              }
              placeholder="Nearest responders + emergency contact"
              placeholderTextColor={COLORS.MUTED}
              style={[styles.input, styles.multilineInput]}
              textAlignVertical="top"
              value={planDraft.roadsidePlan}
            />

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleSavePlan}
              style={styles.saveButton}>
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save emergency card'}
              </Text>
            </TouchableOpacity>
          </View>
        </RevealView>

        <RevealView delay={280}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick numbers</Text>
            <Text style={styles.sectionCaption}>
              Handy references you can keep visible inside the app
            </Text>
          </View>

          <View style={styles.numbersRow}>
            {EMERGENCY_NUMBERS.map(item => (
              <TouchableOpacity
                activeOpacity={0.9}
                key={item.value}
                onPress={() => handleQuickDial(item.value)}
                style={styles.numberCard}>
                <Text style={styles.numberValue}>{item.value}</Text>
                <Text style={styles.numberLabel}>{item.label}</Text>
                <Text style={styles.numberTapHint}>Tap to call</Text>
              </TouchableOpacity>
            ))}
          </View>
        </RevealView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  content: {
    padding: 16,
    paddingBottom: 136,
  },
  scrollBody: {
    flex: 1,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(137, 159, 208, 0.24)',
    marginBottom: 18,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: COLORS.TEXT,
    fontWeight: '700',
    marginLeft: 8,
    fontFamily: FONTS.strong,
  },
  heroTitle: {
    marginTop: 22,
    color: COLORS.TEXT,
    fontSize: 27,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  heroCopy: {
    marginTop: 10,
    color: COLORS.TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.body,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  sectionCaption: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONTS.body,
  },
  card: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  toggleRowActive: {
    borderColor: 'rgba(89, 216, 255, 0.35)',
    backgroundColor: 'rgba(89, 216, 255, 0.08)',
  },
  toggleRowMuted: {
    borderColor: 'rgba(151, 166, 199, 0.22)',
    backgroundColor: 'rgba(5, 8, 22, 0.3)',
  },
  toggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTitle: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
    fontFamily: FONTS.strong,
  },
  toggleSubtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontFamily: FONTS.body,
  },
  toggleAction: {
    alignItems: 'flex-end',
  },
  toggleState: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    fontFamily: FONTS.strong,
  },
  toggleStateActive: {
    color: COLORS.CYAN,
  },
  toggleStateMuted: {
    color: COLORS.MUTED2,
  },
  pillRow: {
    marginBottom: 20,
  },
  sensitivityPill: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  sensitivityPillActive: {
    backgroundColor: 'rgba(22, 36, 61, 0.96)',
    borderColor: 'rgba(89, 216, 255, 0.42)',
  },
  sensitivityTitle: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  sensitivityTitleActive: {
    color: COLORS.CYAN,
  },
  sensitivitySubtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontFamily: FONTS.body,
  },
  inputLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 10,
    fontFamily: FONTS.body,
  },
  input: {
    backgroundColor: 'rgba(11, 17, 32, 0.86)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    color: COLORS.TEXT,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 90,
  },
  saveButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#7BE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.BG,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.strong,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberCard: {
    width: '31%',
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  numberValue: {
    color: COLORS.YELLOW,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  numberLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontFamily: FONTS.body,
  },
  numberTapHint: {
    color: COLORS.CYAN,
    fontSize: 11,
    marginTop: 10,
    fontFamily: FONTS.strong,
  },
});
