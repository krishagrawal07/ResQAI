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
import {useAppContext} from '../context/AppContext';
import FirebaseService from '../services/FirebaseService';
import {COLORS, STORAGE_KEYS} from '../utils/constants';

const EMPTY_ERRORS = {
  name: '',
  phone: '',
  emergencyName: '',
  emergencyPhone: '',
};

export default function LoginScreen({navigation}) {
  const {
    state: {userProfile},
    dispatch,
  } = useAppContext();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    emergencyName: '',
    emergencyPhone: '',
    vehicleMode: 'biker',
  });
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [focusedField, setFocusedField] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      name: userProfile.name,
      phone: userProfile.phone,
      emergencyName: userProfile.emergencyContact?.name ?? '',
      emergencyPhone: userProfile.emergencyContact?.phone ?? '',
      vehicleMode: userProfile.vehicleMode || 'biker',
    });
  }, [userProfile]);

  const isFormValid = useMemo(
    () =>
      Object.values(errors).every(value => !value) &&
      Boolean(
        form.name && form.phone && form.emergencyName && form.emergencyPhone,
      ),
    [errors, form],
  );

  const validate = () => {
    const nextErrors = {
      name: form.name ? '' : 'Full name is required.',
      phone: form.phone ? '' : 'Phone number is required.',
      emergencyName: form.emergencyName
        ? ''
        : 'Emergency contact name is required.',
      emergencyPhone: form.emergencyPhone
        ? ''
        : 'Emergency contact phone is required.',
    };

    setErrors(nextErrors);
    return Object.values(nextErrors).every(value => !value);
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const profile = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        emergencyContact: {
          name: form.emergencyName.trim(),
          phone: form.emergencyPhone.trim(),
        },
        vehicleMode: form.vehicleMode,
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

  const renderInput = ({key, placeholder, keyboardType = 'default', value}) => (
    <View style={styles.fieldBlock} key={key}>
      <TextInput
        onBlur={() => setFocusedField('')}
        onChangeText={text => {
          setForm(current => ({...current, [key]: text}));
          setErrors(current => ({...current, [key]: ''}));
        }}
        onFocus={() => setFocusedField(key)}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={COLORS.MUTED}
        style={[
          styles.input,
          focusedField === key ? styles.inputFocused : null,
        ]}
        value={value}
      />
      {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>RESQ AI</Text>
        <Text style={styles.subhead}>
          AUTONOMOUS MILLISECOND ACCIDENT RESPONSE SYSTEM
        </Text>

        {renderInput({key: 'name', placeholder: 'Full Name', value: form.name})}
        {renderInput({
          key: 'phone',
          placeholder: 'Phone Number',
          keyboardType: 'phone-pad',
          value: form.phone,
        })}
        {renderInput({
          key: 'emergencyName',
          placeholder: 'Emergency Contact Name',
          value: form.emergencyName,
        })}
        {renderInput({
          key: 'emergencyPhone',
          placeholder: 'Emergency Contact Phone',
          keyboardType: 'phone-pad',
          value: form.emergencyPhone,
        })}

        <Text style={styles.sectionLabel}>Vehicle Type</Text>
        <View style={styles.vehicleRow}>
          {[
            {label: 'BIKER', value: 'biker'},
            {label: 'CAR', value: 'car'},
          ].map(option => (
            <TouchableOpacity
              activeOpacity={0.9}
              key={option.value}
              onPress={() =>
                setForm(current => ({...current, vehicleMode: option.value}))
              }
              style={[
                styles.vehicleToggle,
                form.vehicleMode === option.value
                  ? styles.vehicleToggleActive
                  : null,
              ]}>
              <Text
                style={[
                  styles.vehicleToggleText,
                  form.vehicleMode === option.value
                    ? styles.vehicleToggleTextActive
                    : null,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={submitting}
          onPress={handleSubmit}
          style={[
            styles.button,
            submitting || !isFormValid ? styles.buttonBusy : null,
          ]}>
          <Text style={styles.buttonText}>
            {submitting ? 'SECURING PROFILE...' : 'START PROTECTING ME'}
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
    paddingTop: 80,
  },
  logo: {
    color: COLORS.CYAN,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  subhead: {
    color: COLORS.MUTED2,
    marginTop: 8,
    marginBottom: 30,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.BG2,
    borderWidth: 1,
    borderColor: COLORS.MUTED,
    borderRadius: 12,
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
    marginTop: 10,
    marginBottom: 10,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  vehicleRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  vehicleToggle: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.MUTED,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: COLORS.BG2,
  },
  vehicleToggleActive: {
    borderColor: COLORS.CYAN,
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  vehicleToggleText: {
    color: COLORS.MUTED2,
    fontWeight: '700',
    letterSpacing: 1,
  },
  vehicleToggleTextActive: {
    color: COLORS.CYAN,
  },
  button: {
    backgroundColor: COLORS.PINK,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.3,
  },
});
