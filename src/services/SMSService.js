import * as SMS from 'expo-sms';
import {LOCAL_POLICE_SMS_NUMBER} from '../utils/constants';

function hasUsableCoordinates(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  return (
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
  );
}

function normalizePhone(phone) {
  const normalized = String(phone || '').trim();

  if (!normalized || normalized === LOCAL_POLICE_SMS_NUMBER) {
    return null;
  }

  return normalized;
}

function uniquePhones(phones) {
  return [...new Set(phones.map(normalizePhone).filter(Boolean))];
}

function buildEmergencyMessage(userProfile, location) {
  const lat = location?.lat ?? 0;
  const lng = location?.lng ?? 0;
  const name = userProfile?.name ? `\nPerson: ${userProfile.name}` : '';
  const locationLine = hasUsableCoordinates(location)
    ? `Location: https://maps.google.com/?q=${lat},${lng}`
    : 'Location: GPS unavailable. Ask user to share live location manually.';

  return ['Emergency! Possible accident detected.', locationLine, name.trim()]
    .filter(Boolean)
    .join('\n');
}

class SMSService {
  async sendEmergencySMS(
    userProfile,
    location,
    nearbyPolice = [],
    options = {},
  ) {
    const includeGuardianMode = options.includeGuardianMode !== false;
    const includeNearbyResponders = options.includeNearbyResponders !== false;
    const guardianPhone = includeGuardianMode
      ? userProfile?.emergencyContact?.phone
      : null;
    const responderPhone = includeNearbyResponders
      ? nearbyPolice.find(item => normalizePhone(item?.phone))?.phone
      : null;
    const recipients = uniquePhones([guardianPhone, responderPhone]);
    const body = buildEmergencyMessage(userProfile, location);

    if (!recipients.length) {
      return [
        {
          body,
          phone: null,
          status: 'skipped',
          reason: 'No SMS recipients configured',
        },
      ];
    }

    const isAvailable = await SMS.isAvailableAsync().catch(() => false);

    if (!isAvailable) {
      return recipients.map(phone => ({
        body,
        phone,
        status: 'simulated',
        reason: 'SMS composer unavailable on this device',
      }));
    }

    try {
      const result = await SMS.sendSMSAsync(recipients, body);
      return recipients.map(phone => ({
        body,
        phone,
        status: result?.result ?? 'unknown',
      }));
    } catch (error) {
      console.log('Expo SMS send failed', error);
      return recipients.map(phone => ({
        body,
        phone,
        status: 'simulated',
        reason: error?.message || 'SMS failed, simulated local delivery',
      }));
    }
  }
}

export default new SMSService();
