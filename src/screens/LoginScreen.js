import React, {useEffect, useMemo, useState} from 'react';
import {
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
import BrandMark from '../components/BrandMark';
import {useAppContext} from '../context/AppContext';
import FirebaseService from '../services/FirebaseService';
import {
  COLORS,
  DEFAULT_USER_PROFILE,
  MODE_META,
  STORAGE_KEYS,
} from '../utils/constants';

const EMPTY_ERRORS = {
  emergencyName: '',
  emergencyPhone: '',
  name: '',
  phone: '',
};

export default function LoginScreen({navigation}) {
  const {
    state: {userProfile},
    dispatch,
  } = useAppContext();
  const [form, setForm] = useState(DEFAULT_USER_PROFILE);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [focusedField, setFocusedField] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      ...DEFAULT_USER_PROFILE,
      ...userProfile,
      emergencyContact: {
        ...DEFAULT_USER_PROFILE.emergencyContact,
        ...userProfile.emergencyContact,
      },
    });
  }, [userProfile]);

  const isFormValid = useMemo(
    () =>
      Object.values(errors).every(value => !value) &&
      Boolean(
        form.name &&
          form.phone &&
          form.emergencyContact?.name &&
          form.emergencyContact?.phone,
      ),
    [errors, form],
  );

  const validate = () => {
    const nextErrors = {
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

  const handleChange = (field, value) => {
    if (field === 'emergencyName' || field === 'emergencyPhone') {
      const mappedKey = field === 'emergencyName' ? 'name' : 'phone';
      setForm(current => ({
        ...current,
        emergencyContact: {
          ...current.emergencyContact,
          [mappedKey]: value,
        },
      }));
      setErrors(current => ({...current, [field]: ''}));
      return;
    }

    setForm(current => ({...current, [field]: value}));
    setErrors(current => ({...current, [field]: ''}));
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const profile = {
        ...DEFAULT_USER_PROFILE,
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        emergencyContact: {
          name: form.emergencyContact?.name?.trim() ?? '',
          phone: form.emergencyContact?.phone?.trim() ?? '',
        },
        medicalNotes: form.medicalNotes?.trim() ?? '',
        vehicleId: form.vehicleId?.trim() ?? '',
      };

      const user = await FirebaseService.signInAnonymously();
      const userId = user?.uid ?? (await FirebaseService.getLocalUserId());

      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify(profile),
      );
      await FirebaseService.saveUserProfile(userId ?? 'local-user', profile);

      dispatch({type: 'SET_USER_PROFILE', payload: profile});
      dispatch({type: 'SET_MODE', payload: profile.vehicleMode});

      navigation.reset({
        index: 0,
        routes: [{name: 'MainTabs'}],
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = ({
    errorKey,
    field,
    keyboardType = 'default',
    placeholder,
    value,
  }) => (
    <View style={styles.fieldBlock} key={field}>
      <TextInput
        onBlur={() => setFocusedField('')}
        onChangeText={text => handleChange(field, text)}
        onFocus={() => setFocusedField(field)}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={COLORS.MUTED}
        style={[
          styles.input,
          focusedField === field ? styles.inputFocused : null,
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#10192B', '#131F35', '#16243D']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.hero}>
          <BrandMark
            showWordmark
            size={62}
            subtitle="A smarter safety experience from the first screen"
          />
          <Text style={styles.heroTitle}>Set up your rescue identity</Text>
          <Text style={styles.heroCopy}>
            Add the essentials now. You can refine the rest inside the new
            Profile and Safety tabs after sign-in.
          </Text>
        </LinearGradient>

        {renderInput({
          errorKey: 'name',
          field: 'name',
          placeholder: 'Full name',
          value: form.name,
        })}
        {renderInput({
          errorKey: 'phone',
          field: 'phone',
          keyboardType: 'phone-pad',
          placeholder: 'Phone number',
          value: form.phone,
        })}
        {renderInput({
          errorKey: 'emergencyName',
          field: 'emergencyName',
          placeholder: 'Emergency contact name',
          value: form.emergencyContact?.name ?? '',
        })}
        {renderInput({
          errorKey: 'emergencyPhone',
          field: 'emergencyPhone',
          keyboardType: 'phone-pad',
          placeholder: 'Emergency contact phone',
          value: form.emergencyContact?.phone ?? '',
        })}

        <Text style={styles.sectionLabel}>Choose your main vehicle</Text>
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
          disabled={submitting || !isFormValid}
          onPress={handleSubmit}
          style={[
            styles.button,
            submitting || !isFormValid ? styles.buttonBusy : null,
          ]}>
          <Text style={styles.buttonText}>
            {submitting ? 'Saving profile...' : 'Enter the app'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 34,
    paddingBottom: 44,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 18,
  },
  heroTitle: {
    color: COLORS.TEXT,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 22,
  },
  heroCopy: {
    color: COLORS.TEXT_DIM,
    marginTop: 10,
    lineHeight: 22,
    fontSize: 14,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 16,
    color: COLORS.TEXT,
    padding: 14,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: COLORS.CYAN,
  },
  errorText: {
    color: COLORS.PINK,
    fontSize: 12,
    marginTop: 6,
  },
  sectionLabel: {
    color: COLORS.MUTED2,
    marginTop: 12,
    marginBottom: 12,
    fontSize: 12,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeCard: {
    width: '48%',
    backgroundColor: COLORS.CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeCardActive: {
    backgroundColor: COLORS.CARD_ALT,
  },
  modeCardTitle: {
    color: COLORS.TEXT,
    fontWeight: '800',
    marginLeft: 10,
  },
  button: {
    backgroundColor: COLORS.CYAN,
    borderRadius: 18,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.BG,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
