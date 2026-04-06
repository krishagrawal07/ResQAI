import Twilio from 'twilio';
import env from '../config/env.js';
import store from './store.js';

const STATIC_EMERGENCY_CONTACTS = [
  {name: 'Emergency Desk', phone: env.offlineFallbackPhone, channel: 'sms'},
];

function buildMessage({incident, recipientName}) {
  const userName = incident.userProfile?.name || 'Unknown driver';
  const severity = incident.severity?.label || 'Low';
  const score = incident.severity?.score ?? 0;

  return [
    'RESQ AI EMERGENCY ALERT',
    `Incident: ${incident.id}`,
    `User: ${userName}`,
    `Severity: ${severity} (${score}/100)`,
    `Location: ${incident.location.address || incident.locationLabel}`,
    `Maps: ${incident.mapsUrl}`,
    `Live Track: ${incident.trackingUrl}`,
    `Recipient: ${recipientName}`,
  ].join('\n');
}

class NotificationService {
  constructor() {
    this.twilioClient = env.isTwilioConfigured
      ? Twilio(env.twilio.accountSid, env.twilio.authToken)
      : null;
  }

  normalizeContacts(incident, hospitals = []) {
    const includeGuardianMode =
      incident.dispatchPreferences?.guardianMode !== false;
    const includeNearbyResponders =
      incident.dispatchPreferences?.notifyNearbyResponders !== false;

    const userContact =
      includeGuardianMode && incident.userProfile?.emergencyContact?.phone
        ? [
            {
              name:
                incident.userProfile?.emergencyContact?.name ||
                'Primary Emergency Contact',
              phone: incident.userProfile.emergencyContact.phone,
              channel: 'sms',
              type: 'contact',
            },
          ]
        : [];

    const hospitalContacts = includeNearbyResponders
      ? hospitals.map(item => ({
          name: item.name,
          phone: item.phone,
          channel: 'sms',
          type: 'hospital',
        }))
      : [];

    return [
      ...userContact,
      ...hospitalContacts,
      ...STATIC_EMERGENCY_CONTACTS,
    ].filter(item => item.phone);
  }

  async sendSms(phone, body) {
    if (!this.twilioClient) {
      return {status: 'mock-sent', provider: 'mock'};
    }

    const response = await this.twilioClient.messages.create({
      body,
      from: env.twilio.fromPhone,
      to: phone,
    });

    return {
      status: response.status || 'queued',
      provider: 'twilio',
      sid: response.sid,
    };
  }

  async dispatchEmergencyNotifications(incident, hospitals = []) {
    const recipients = this.normalizeContacts(incident, hospitals);

    const attempts = await Promise.all(
      recipients.map(async recipient => {
        const body = buildMessage({
          incident,
          recipientName: recipient.name,
        });

        try {
          const result = await this.sendSms(recipient.phone, body);
          return {
            channel: recipient.channel,
            name: recipient.name,
            phone: recipient.phone,
            provider: result.provider,
            status: result.status,
            type: recipient.type,
          };
        } catch (error) {
          store.queueFallbackNotification({
            incidentId: incident.id,
            name: recipient.name,
            phone: recipient.phone,
            reason: error.message,
            type: recipient.type,
          });

          return {
            channel: recipient.channel,
            name: recipient.name,
            phone: recipient.phone,
            provider: 'fallback',
            status: 'queued-offline',
            type: recipient.type,
          };
        }
      }),
    );

    return attempts;
  }

  async processFallbackQueue() {
    const queue = store.listFallbackQueue();
    if (queue.length === 0) return;

    const toRetry = queue.filter(item => {
      const ageMinutes = (Date.now() - new Date(item.queuedAt)) / (1000 * 60);
      return ageMinutes >= 1; // retry after 1 minute
    });

    for (const item of toRetry) {
      try {
        // Find the incident
        const incident = store.getIncident(item.incidentId);
        if (!incident) continue;

        const body = buildMessage({
          incident,
          recipientName: item.name,
        });

        const result = await this.sendSms(item.phone, body);
        
        // If successful, remove from queue
        // For simplicity, we'll recreate the queue without this item
        store.fallbackQueue = store.fallbackQueue.filter(q => q !== item);
        store.saveFallbackQueue();

        console.log(`Fallback SMS sent to ${item.name}: ${result.status}`);
      } catch (error) {
        console.error(`Fallback SMS failed for ${item.name}: ${error.message}`);
        // Keep in queue for next retry
      }
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
