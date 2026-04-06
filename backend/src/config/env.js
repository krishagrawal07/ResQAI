import dotenv from 'dotenv';

dotenv.config();

function parsePort(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const env = {
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  dashboardPublicUrl:
    process.env.DASHBOARD_PUBLIC_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  offlineFallbackPhone: process.env.OFFLINE_FALLBACK_PHONE || '+10000000000',
  port: parsePort(process.env.PORT, 4000),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromPhone: process.env.TWILIO_PHONE_NUMBER || '',
  },
};

env.isTwilioConfigured = Boolean(
  env.twilio.accountSid && env.twilio.authToken && env.twilio.fromPhone,
);

export default env;
