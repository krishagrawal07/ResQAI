import {Platform} from 'react-native';
import {RESQ_API_BASE_URL} from '@env';

const DEFAULT_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:4000/api'
    : 'http://localhost:4000/api';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function parseJsonResponse(text, response) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (!response.ok) {
      return {message: text};
    }

    throw new Error('Backend returned an invalid JSON response.');
  }
}

class BackendService {
  constructor() {
    this.baseUrl = trimTrailingSlash(RESQ_API_BASE_URL || DEFAULT_BASE_URL);
  }

  getApiBaseUrl() {
    return this.baseUrl;
  }

  async request(path, options = {}) {
    const {timeoutMs = 10000, ...fetchOptions} = options;
    const controller =
      typeof AbortController !== 'undefined' && !fetchOptions.signal
        ? new AbortController()
        : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    let response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...fetchOptions,
        signal: fetchOptions.signal ?? controller?.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(fetchOptions.headers ?? {}),
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Backend request timed out. Check network connection.');
      }

      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    const text = await response.text();
    const payload = parseJsonResponse(text, response);

    if (!response.ok) {
      const message =
        payload?.message || `Request failed with ${response.status}`;
      throw new Error(message);
    }

    return payload;
  }

  async createIncident(payload) {
    const response = await this.request('/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.incident;
  }

  async updateIncidentLocation(incidentId, location) {
    const response = await this.request(`/incidents/${incidentId}/location`, {
      method: 'PATCH',
      body: JSON.stringify(location),
    });

    return response.incident;
  }

  async updateIncidentStatus(incidentId, status) {
    const response = await this.request(`/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({status}),
    });

    return response.incident;
  }

  async fetchActiveIncidents() {
    const response = await this.request('/incidents?status=active');
    return response.incidents ?? [];
  }
}

const backendService = new BackendService();

export default backendService;
