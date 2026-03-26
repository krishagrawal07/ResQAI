import axios from 'axios';
import {TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER} from '@env';
import {LOCAL_POLICE_SMS_NUMBER} from '../utils/constants';

class SMSService {
  async sendSingleSMS(to, body) {
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', TWILIO_PHONE_NUMBER);
    params.append('Body', body);

    return axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      params.toString(),
      {
        auth: {
          username: TWILIO_ACCOUNT_SID,
          password: TWILIO_AUTH_TOKEN,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
  }

  async sendEmergencySMS(userProfile, location, nearbyPolice = []) {
    const message = [
      'EMERGENCY ALERT - ResQ AI',
      `${userProfile.name} may have been in a crash.`,
      '',
      `Location: ${location.address}`,
      `Maps: https://maps.google.com/?q=${location.lat},${location.lng}`,
      `Nearest Police: ${nearbyPolice[0]?.name ?? 'Dispatching nearest unit'}`,
      'Please respond immediately.',
    ].join('\n');

    const recipients = [
      userProfile?.emergencyContact?.phone,
      LOCAL_POLICE_SMS_NUMBER,
    ].filter(Boolean);

    if (
      !TWILIO_ACCOUNT_SID ||
      !TWILIO_AUTH_TOKEN ||
      !TWILIO_PHONE_NUMBER ||
      TWILIO_ACCOUNT_SID === 'your_sid_here'
    ) {
      console.log('Twilio credentials are missing; SMS skipped.');
      return recipients.map(phone => ({phone, status: 'skipped'}));
    }

    const results = await Promise.allSettled(
      recipients.map(phone => this.sendSingleSMS(phone, message)),
    );

    return results.map((result, index) => ({
      phone: recipients[index],
      status: result.status,
    }));
  }
}

export default new SMSService();
