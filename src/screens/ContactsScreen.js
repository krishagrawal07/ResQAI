import React, {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import RevealView from '../components/RevealView';
import {useAppContext} from '../context/AppContext';
import FirebaseService from '../services/FirebaseService';
import {COLORS, FONTS, STORAGE_KEYS} from '../utils/constants';

const QUICK_LINES = [
  {label: 'National Emergency', number: '112'},
  {label: 'Ambulance', number: '108'},
  {label: 'Police', number: '100'},
];

export default function ContactsScreen() {
  const {
    state: {userProfile},
    dispatch,
  } = useAppContext();

  const [name, setName] = useState(userProfile.emergencyContact?.name || '');
  const [phone, setPhone] = useState(userProfile.emergencyContact?.phone || '');
  const [relation, setRelation] = useState(
    userProfile.emergencyContact?.relation || '',
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert(
        'Missing details',
        'Please provide both name and phone for the emergency contact.',
      );
      return;
    }

    setSaving(true);

    try {
      const nextProfile = {
        ...userProfile,
        emergencyContact: {
          ...userProfile.emergencyContact,
          name: name.trim(),
          phone: phone.trim(),
          relation: relation.trim(),
        },
      };

      dispatch({type: 'SET_USER_PROFILE', payload: nextProfile});
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify(nextProfile),
      );

      try {
        const user = await FirebaseService.signInAnonymously();
        const userId = user?.uid ?? (await FirebaseService.getLocalUserId());
        await FirebaseService.saveUserProfile(
          userId ?? 'local-user',
          nextProfile,
        );
      } catch (error) {
        // Local save already completed; cloud sync can retry later.
      }

      Alert.alert('Saved', 'Emergency contact updated successfully.');
    } catch (error) {
      Alert.alert('Save failed', 'Unable to save emergency contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickDial = async number => {
    const url = `tel:${number}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Dial unavailable', `Calling ${number} is not supported.`);
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Dial failed', `Unable to start call for ${number}.`);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <AuroraBackground variant="safety" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <RevealView delay={50}>
          <LinearGradient
            colors={['rgba(16, 25, 43, 0.95)', 'rgba(22, 36, 61, 0.8)']}
            end={{x: 1, y: 1}}
            start={{x: 0, y: 0}}
            style={styles.hero}>
            <View style={styles.heroBadge}>
              <Ionicons color={COLORS.PINK} name="call-outline" size={18} />
              <Text style={styles.heroBadgeText}>Emergency contacts</Text>
            </View>
            <Text style={styles.heroTitle}>Who should get alerted first?</Text>
            <Text style={styles.heroCopy}>
              ResQ AI sends location, severity, and live tracking link to this
              contact the moment an accident is confirmed.
            </Text>
          </LinearGradient>
        </RevealView>

        <RevealView delay={120}>
          <View style={styles.formCard}>
            <Text style={styles.label}>Primary contact name</Text>
            <TextInput
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={COLORS.MUTED}
              style={styles.input}
              value={name}
            />

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="+91..."
              placeholderTextColor={COLORS.MUTED}
              style={styles.input}
              value={phone}
            />

            <Text style={styles.label}>Relationship</Text>
            <TextInput
              onChangeText={setRelation}
              placeholder="Parent, spouse, sibling..."
              placeholderTextColor={COLORS.MUTED}
              style={styles.input}
              value={relation}
            />

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleSave}
              style={styles.saveButton}>
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save emergency contact'}
              </Text>
            </TouchableOpacity>
          </View>
        </RevealView>

        <RevealView delay={180}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick dial references</Text>
          </View>
          <View style={styles.quickRow}>
            {QUICK_LINES.map(item => (
              <TouchableOpacity
                activeOpacity={0.9}
                key={item.number}
                onPress={() => handleQuickDial(item.number)}
                style={styles.quickCard}>
                <Text style={styles.quickNumber}>{item.number}</Text>
                <Text style={styles.quickLabel}>{item.label}</Text>
                <Text style={styles.quickTapHint}>Tap to call</Text>
              </TouchableOpacity>
            ))}
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
    borderColor: 'rgba(137, 159, 208, 0.24)',
    marginBottom: 18,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: COLORS.TEXT,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.strong,
  },
  heroTitle: {
    marginTop: 20,
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
  formCard: {
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 20,
  },
  label: {
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
  saveButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.strong,
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
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickCard: {
    width: '31%',
    backgroundColor: 'rgba(16, 25, 43, 0.9)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  quickNumber: {
    color: COLORS.YELLOW,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.heading,
  },
  quickLabel: {
    color: COLORS.MUTED2,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  quickTapHint: {
    color: COLORS.CYAN,
    fontSize: 11,
    marginTop: 10,
    fontFamily: FONTS.strong,
  },
});
