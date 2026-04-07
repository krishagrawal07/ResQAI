import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AuroraBackground from '../components/AuroraBackground';
import BrandMark from '../components/BrandMark';
import RevealView from '../components/RevealView';
import {useAppContext} from '../context/AppContext';
import FirebaseService from '../services/FirebaseService';
import {COLORS, FONTS, MODE_META, STORAGE_KEYS} from '../utils/constants';

const EMPTY_ERRORS = {
  bloodGroup: '',
  city: '',
  emergencyName: '',
  emergencyPhone: '',
  medicalNotes: '',
  name: '',
  phone: '',
};

export default function ProfileScreen() {
  const {
    state: {preferences, runtime, userProfile},
    dispatch,
  } = useAppContext();
  const [form, setForm] = useState(userProfile);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [focusedField, setFocusedField] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(userProfile);
  }, [userProfile]);

  const statusTiles = useMemo(
    () => [
      {
        key: 'protection',
        label: 'Protection style',
        value: preferences.detectionSensitivity,
      },
      {
        key: 'cloud',
        label: 'Cloud sync',
        value: runtime.firebaseReady ? 'Ready' : 'Local mode',
      },
      {
        key: 'guardian',
        label: 'Guardian',
        value: preferences.guardianMode ? 'Enabled' : 'Off',
      },
    ],
    [
      preferences.detectionSensitivity,
      preferences.guardianMode,
      runtime.firebaseReady,
    ],
  );

  const validate = () => {
    const nextErrors = {
      city: form.city ? '' : 'City is required.',
      emergencyName: form.emergencyContact?.name
        ? ''
        : 'Emergency contact name is required.',
      emergencyPhone: form.emergencyContact?.phone
        ? ''
        : 'Emergency contact phone is required.',
      name: form.name ? '' : 'Full name is required.',
      phone: form.phone ? '' : 'Phone number is required.',
    };

    setErrors(nextErrors);
    return Object.values(nextErrors).every(value => !value);
  };

  const handleChange = (key, value) => {
    if (key === 'emergencyName' || key === 'emergencyPhone') {
      const mappedKey = key === 'emergencyName' ? 'name' : 'phone';
      setForm(current => ({
        ...current,
        emergencyContact: {
          ...current.emergencyContact,
          [mappedKey]: value,
        },
      }));
      setErrors(current => ({...current, [key]: ''}));
      return;
    }

    setForm(current => ({...current, [key]: value}));
    setErrors(current => ({...current, [key]: ''}));
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const profile = {
        ...userProfile,
        ...form,
        emergencyContact: {
          ...userProfile.emergencyContact,
          ...form.emergencyContact,
        },
      };

      const user = await FirebaseService.signInAnonymously();
      const userId = user?.uid ?? (await FirebaseService.getLocalUserId());

      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify(profile),
      );
      try {
        await FirebaseService.saveUserProfile(userId ?? 'local-user', profile);
      } catch (error) {
        // Local save already succeeded; cloud sync can retry later.
      }

      dispatch({type: 'SET_USER_PROFILE', payload: profile});
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert('Save failed', 'Unable to save profile right now.');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = ({
    errorKey,
    fieldKey,
    keyboardType = 'default',
    placeholder,
    value,
  }) => (
    <View style={styles.fieldBlock} key={fieldKey}>
      <TextInput
        onBlur={() => setFocusedField('')}
        onChangeText={text => handleChange(fieldKey, text)}
        onFocus={() => setFocusedField(fieldKey)}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={COLORS.MUTED}
        style={[
          styles.input,
          focusedField === fieldKey ? styles.inputFocused : null,
        ]}
        value={value}
      />
      {errors[errorKey] ? (
        <Text style={styles.errorText}>{errors[errorKey]}</Text>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <AuroraBackground variant="profile" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <RevealView delay={50}>
          <LinearGradient
            colors={['rgba(28, 28, 30, 0.95)', 'rgba(13, 13, 13, 0.84)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.hero}>
            <BrandMark
              showWordmark
              size={64}
              subtitle="Profile and rescue identity"
            />
            <Text style={styles.heroTitle}>Your rescue profile</Text>
            <Text style={styles.heroCopy}>
              Keep your identity, contacts, and vehicle details ready so
              emergency outreach feels instant instead of improvised.
            </Text>

            <View style={styles.statusRow}>
              {statusTiles.map(tile => (
                <View key={tile.key} style={styles.statusTile}>
                  <Text style={styles.statusTileLabel}>{tile.label}</Text>
                  <Text style={styles.statusTileValue}>{tile.value}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </RevealView>

        <RevealView delay={100}>
          <View style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <View>
                <Text style={styles.contactEyebrow}>Emergency contacts</Text>
                <Text style={styles.contactTitle}>Primary responder</Text>
              </View>
              <View style={styles.contactLiveBadge}>
                <Ionicons
                  color={COLORS.SUCCESS}
                  name="shield-checkmark"
                  size={15}
                />
                <Text style={styles.contactLiveText}>Ready</Text>
              </View>
            </View>

            <View style={styles.contactPersonRow}>
              <LinearGradient
                colors={[COLORS.PRIMARY, COLORS.ACCENT]}
                end={{x: 1, y: 1}}
                start={{x: 0, y: 0}}
                style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {(form.emergencyContact?.name || 'E').slice(0, 1)}
                </Text>
              </LinearGradient>
              <View style={styles.contactPersonCopy}>
                <Text style={styles.contactName}>
                  {form.emergencyContact?.name || 'Add emergency contact'}
                </Text>
                <Text style={styles.contactPhone}>
                  {form.emergencyContact?.phone ||
                    'Phone number required for dispatch'}
                </Text>
              </View>
              <Ionicons color={COLORS.MUTED2} name="call-outline" size={22} />
            </View>

            <View style={styles.medicalRow}>
              <View style={styles.medicalTile}>
                <Text style={styles.medicalLabel}>Blood</Text>
                <Text style={styles.medicalValue}>
                  {form.bloodGroup || 'Unknown'}
                </Text>
              </View>
              <View style={styles.medicalTile}>
                <Text style={styles.medicalLabel}>Vehicle</Text>
                <Text numberOfLines={1} style={styles.medicalValue}>
                  {form.vehicleId ||
                    MODE_META[form.vehicleMode]?.label ||
                    'Bike'}
                </Text>
              </View>
            </View>
          </View>
        </RevealView>

        <RevealView delay={130}>
          <View style={styles.formCard}>
            {renderInput({
              errorKey: 'name',
              fieldKey: 'name',
              placeholder: 'Full name',
              value: form.name,
            })}
            {renderInput({
              errorKey: 'phone',
              fieldKey: 'phone',
              keyboardType: 'phone-pad',
              placeholder: 'Phone number',
              value: form.phone,
            })}
            {renderInput({
              errorKey: 'city',
              fieldKey: 'city',
              placeholder: 'Home city',
              value: form.city,
            })}
            {renderInput({
              errorKey: 'bloodGroup',
              fieldKey: 'bloodGroup',
              placeholder: 'Blood group (A+, O-, etc.)',
              value: form.bloodGroup,
            })}
            {renderInput({
              errorKey: 'medicalNotes',
              fieldKey: 'medicalNotes',
              placeholder: 'Medical conditions or allergies',
              value: form.medicalNotes,
            })}
            {renderInput({
              errorKey: 'emergencyName',
              fieldKey: 'emergencyName',
              placeholder: 'Emergency contact name',
              value: form.emergencyContact?.name ?? '',
            })}
            {renderInput({
              errorKey: 'emergencyPhone',
              fieldKey: 'emergencyPhone',
              keyboardType: 'phone-pad',
              placeholder: 'Emergency contact phone',
              value: form.emergencyContact?.phone ?? '',
            })}
            {renderInput({
              errorKey: 'vehicleId',
              fieldKey: 'vehicleId',
              placeholder: 'Vehicle number or label',
              value: form.vehicleId,
            })}

            <Text style={styles.sectionLabel}>Vehicle profile</Text>
            <View style={styles.modeGrid}>
              {Object.values(MODE_META).map(option => {
                const selected = form.vehicleMode === option.value;

                return (
                  <TouchableOpacity
                    activeOpacity={0.92}
                    key={option.value}
                    onPress={() =>
                      setForm(current => ({
                        ...current,
                        vehicleMode: option.value,
                      }))
                    }
                    style={[
                      styles.modeCard,
                      selected ? styles.modeCardActive : null,
                    ]}>
                    <Ionicons
                      color={selected ? option.accent : COLORS.MUTED2}
                      name={option.icon}
                      size={20}
                    />
                    <Text
                      style={[
                        styles.modeCardTitle,
                        selected ? {color: option.accent} : null,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleSave}
              style={styles.saveButton}>
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving profile...' : 'Save profile'}
              </Text>
            </TouchableOpacity>
          </View>
        </RevealView>
      </ScrollView>
    </KeyboardAvoidingView>
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
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: 18,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 20},
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statusTile: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 12,
  },
  statusTileLabel: {
    color: COLORS.MUTED2,
    fontSize: 11,
    marginBottom: 6,
    fontFamily: FONTS.body,
  },
  statusTileValue: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'capitalize',
    fontFamily: FONTS.strong,
  },
  contactCard: {
    backgroundColor: 'rgba(22, 22, 24, 0.92)',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 18,
    shadowColor: COLORS.ACCENT,
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  contactEyebrow: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: FONTS.strong,
  },
  contactTitle: {
    color: COLORS.TEXT,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
    fontFamily: FONTS.heading,
  },
  contactLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.24)',
  },
  contactLiveText: {
    color: COLORS.SUCCESS,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 6,
    fontFamily: FONTS.strong,
  },
  contactPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontFamily: FONTS.heading,
  },
  contactPersonCopy: {
    flex: 1,
  },
  contactName: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: FONTS.strong,
  },
  contactPhone: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 5,
    fontFamily: FONTS.body,
  },
  medicalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  medicalTile: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 14,
  },
  medicalLabel: {
    color: COLORS.MUTED2,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: FONTS.strong,
  },
  medicalValue: {
    color: COLORS.TEXT,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
    fontFamily: FONTS.heading,
  },
  formCard: {
    backgroundColor: 'rgba(22, 22, 24, 0.92)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fieldBlock: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 16,
    color: COLORS.TEXT,
    padding: 14,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: COLORS.ACCENT,
  },
  errorText: {
    color: COLORS.PINK,
    fontSize: 12,
    marginTop: 6,
  },
  sectionLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 12,
    fontFamily: FONTS.body,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modeCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: 'rgba(11, 17, 32, 0.88)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeCardActive: {
    backgroundColor: 'rgba(22, 36, 61, 0.96)',
    borderColor: 'rgba(89, 216, 255, 0.42)',
  },
  modeCardTitle: {
    color: COLORS.TEXT,
    fontWeight: '800',
    marginLeft: 10,
    fontFamily: FONTS.strong,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: COLORS.ACCENT,
    borderRadius: 18,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.BG,
    fontWeight: '800',
    fontSize: 14,
    fontFamily: FONTS.strong,
  },
});
