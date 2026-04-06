import {Platform} from 'react-native';
import {RESQ_API_BASE_URL} from '@env';

const DEFAULT_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:4000/api'
    : 'http://localhost:4000/api';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

class BackendService {
  constructor() {
    this.baseUrl = trimTrailingSlash(RESQ_API_BASE_URL || DEFAULT_BASE_URL);
  }

  getApiBaseUrl() {
    return this.baseUrl;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

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
