import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAppContext} from '../context/AppContext';
import {COLORS, SENSITIVITY_OPTIONS, STORAGE_KEYS} from '../utils/constants';

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

  const handleToggle = async key => {
    const nextPreferences = {[key]: !preferences[key]};
    dispatch({type: 'SET_PREFERENCES', payload: nextPreferences});
    await AsyncStorage.setItem(
      STORAGE_KEYS.APP_PREFERENCES,
      JSON.stringify({...preferences, ...nextPreferences}),
    );
  };

  const handleSensitivityChange = async nextValue => {
    dispatch({
      type: 'SET_PREFERENCES',
      payload: {detectionSensitivity: nextValue},
    });
    await AsyncStorage.setItem(
      STORAGE_KEYS.APP_PREFERENCES,
      JSON.stringify({...preferences, detectionSensitivity: nextValue}),
    );
  };

  const handleSavePlan = async () => {
    setSaving(true);
    try {
      dispatch({type: 'SET_EMERGENCY_PLAN', payload: planDraft});
      await AsyncStorage.setItem(
        STORAGE_KEYS.EMERGENCY_PLAN,
        JSON.stringify(planDraft),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <LinearGradient
        colors={['#10192B', '#131F35', '#16243D']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons color={COLORS.YELLOW} name="options-outline" size={18} />
          <Text style={styles.heroBadgeText}>Safety command center</Text>
        </View>
        <Text style={styles.heroTitle}>Control how protection behaves</Text>
        <Text style={styles.heroCopy}>
          Tune alert sensitivity, guardian behavior, and the emergency card that
          gets shared during a real rescue event.
        </Text>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Protection switches</Text>
        <Text style={styles.sectionCaption}>
          The settings that shape your response flow
        </Text>
      </View>

      <View style={styles.card}>
        {TOGGLES.map(item => (
          <View key={item.key} style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <View style={styles.toggleTitleRow}>
                <Ionicons color={COLORS.CYAN} name={item.icon} size={18} />
                <Text style={styles.toggleTitle}>{item.title}</Text>
              </View>
              <Text style={styles.toggleSubtitle}>{item.subtitle}</Text>
            </View>
            <Switch
              onValueChange={() => handleToggle(item.key)}
              thumbColor={preferences[item.key] ? COLORS.CYAN : '#E5E7EB'}
              trackColor={{
                false: 'rgba(151, 166, 199, 0.35)',
                true: 'rgba(89, 216, 255, 0.4)',
              }}
              value={Boolean(preferences[item.key])}
            />
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Detection sensitivity</Text>
        <Text style={styles.sectionCaption}>
          Choose how cautious the crash model should feel
        </Text>
      </View>

      <View style={styles.pillRow}>
        {SENSITIVITY_OPTIONS.map(option => {
          const selected = preferences.detectionSensitivity === option.value;

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              key={option.value}
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
              <Text style={styles.sensitivitySubtitle}>{option.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick numbers</Text>
        <Text style={styles.sectionCaption}>
          Handy references you can keep visible inside the app
        </Text>
      </View>

      <View style={styles.numbersRow}>
        {EMERGENCY_NUMBERS.map(item => (
          <View key={item.value} style={styles.numberCard}>
            <Text style={styles.numberValue}>{item.value}</Text>
            <Text style={styles.numberLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
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
  },
  heroTitle: {
    marginTop: 22,
    color: COLORS.TEXT,
    fontSize: 27,
    fontWeight: '800',
  },
  heroCopy: {
    marginTop: 10,
    color: COLORS.TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionCaption: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  },
  toggleSubtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  pillRow: {
    marginBottom: 20,
  },
  sensitivityPill: {
    backgroundColor: COLORS.CARD,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  sensitivityPillActive: {
    backgroundColor: COLORS.CARD_ALT,
    borderColor: COLORS.CYAN,
  },
  sensitivityTitle: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '800',
  },
  sensitivityTitleActive: {
    color: COLORS.CYAN,
  },
  sensitivitySubtitle: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  inputLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.BG2,
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
    backgroundColor: COLORS.CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.BG,
    fontSize: 14,
    fontWeight: '800',
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberCard: {
    width: '31%',
    backgroundColor: COLORS.CARD,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  numberValue: {
    color: COLORS.YELLOW,
    fontSize: 24,
    fontWeight: '800',
  },
  numberLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
