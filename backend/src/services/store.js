import {v4 as uuidv4} from 'uuid';
import fs from 'fs';
import path from 'path';
import env from '../config/env.js';
import {formatCoordinates} from '../utils/geo.js';

function nowIso() {
  return new Date().toISOString();
}

class IncidentStore {
  incidents = new Map();
  fallbackQueue = [];
  dataDir = path.join(process.cwd(), 'data');
  incidentsFile = path.join(this.dataDir, 'incidents.json');
  fallbackFile = path.join(this.dataDir, 'fallback.json');

  constructor() {
    this.ensureDataDir();
    this.loadIncidents();
    this.loadFallbackQueue();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadIncidents() {
    try {
      if (fs.existsSync(this.incidentsFile)) {
        const data = fs.readFileSync(this.incidentsFile, 'utf8');
        const incidentsArray = JSON.parse(data);
        this.incidents = new Map(incidentsArray.map(incident => [incident.id, incident]));
      }
    } catch (error) {
      console.error('Failed to load incidents:', error);
    }
  }

  saveIncidents() {
    try {
      const incidentsArray = Array.from(this.incidents.values());
      fs.writeFileSync(this.incidentsFile, JSON.stringify(incidentsArray, null, 2));
    } catch (error) {
      console.error('Failed to save incidents:', error);
    }
  }

  loadFallbackQueue() {
    try {
      if (fs.existsSync(this.fallbackFile)) {
        const data = fs.readFileSync(this.fallbackFile, 'utf8');
        this.fallbackQueue = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load fallback queue:', error);
    }
  }

  saveFallbackQueue() {
    try {
      fs.writeFileSync(this.fallbackFile, JSON.stringify(this.fallbackQueue, null, 2));
    } catch (error) {
      console.error('Failed to save fallback queue:', error);
    }
  }

  createIncident(payload) {
    const id = uuidv4();
    const shareToken = uuidv4().replace(/-/g, '');
    const createdAt = nowIso();
    const trackingUrl = `${env.dashboardPublicUrl}/track/${shareToken}`;
    const mapsUrl = `https://maps.google.com/?q=${payload.location.lat},${payload.location.lng}`;

    const incident = {
      id,
      shareToken,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      mapsUrl,
      trackingUrl,
      locationLabel: formatCoordinates(
        payload.location.lat,
        payload.location.lng,
      ),
      location: payload.location,
      locationHistory: [
        {
          lat: payload.location.lat,
          lng: payload.location.lng,
          address: payload.location.address || '',
          speedKmh: payload.location.speedKmh || 0,
          timestamp: createdAt,
        },
      ],
      mode: payload.mode || 'biker',
      dispatchPreferences: payload.dispatchPreferences || {},
      userProfile: payload.userProfile || {},
      emergencyPlan: payload.emergencyPlan || {},
      sensorSnapshot: payload.sensorSnapshot || {},
      severity: payload.severity,
      notifications: payload.notifications || [],
      hospitals: payload.hospitals || [],
      metadata: payload.metadata || {},
    };

    this.incidents.set(id, incident);
    this.saveIncidents();
    return incident;
  }

  updateIncident(id, patch) {
    const current = this.incidents.get(id);
    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.incidents.set(id, next);
    this.saveIncidents();
    return next;
  }

  addLocationPing(id, locationPatch) {
    const current = this.incidents.get(id);
    if (!current) {
      return null;
    }

    const timestamp = nowIso();
    const nextHistory = [
      ...current.locationHistory,
      {
        lat: locationPatch.lat,
        lng: locationPatch.lng,
        address: locationPatch.address || '',
        speedKmh: locationPatch.speedKmh || 0,
        timestamp,
      },
    ].slice(-120);

    const next = {
      ...current,
      location: {
        ...current.location,
        ...locationPatch,
      },
      locationLabel: formatCoordinates(locationPatch.lat, locationPatch.lng),
      locationHistory: nextHistory,
      updatedAt: timestamp,
    };

    this.incidents.set(id, next);
    this.saveIncidents();
    return next;
  }

  getIncident(id) {
    return this.incidents.get(id) || null;
  }

  getIncidentByShareToken(shareToken) {
    for (const incident of this.incidents.values()) {
      if (incident.shareToken === shareToken) {
        return incident;
      }
    }

    return null;
  }

  listIncidents() {
    return Array.from(this.incidents.values()).sort(
      (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
    );
  }

  listActiveIncidents() {
    return this.listIncidents().filter(item => item.status === 'active');
  }

  getMetrics() {
    const incidents = this.listIncidents();
    const active = incidents.filter(item => item.status === 'active').length;
    const critical = incidents.filter(
      item => item.severity?.label === 'Critical',
    ).length;
    const medium = incidents.filter(
      item => item.severity?.label === 'Medium',
    ).length;
    const low = incidents.filter(item => item.severity?.label === 'Low').length;

    return {
      total: incidents.length,
      active,
      severity: {
        Critical: critical,
        Medium: medium,
        Low: low,
      },
    };
  }

  getHeatmapPoints() {
    return this.listIncidents().map(item => ({
      id: item.id,
      lat: item.location?.lat || 0,
      lng: item.location?.lng || 0,
      intensity: item.severity?.score || 25,
      severity: item.severity?.label || 'Low',
      timestamp: item.createdAt,
    }));
  }

  queueFallbackNotification(entry) {
    this.fallbackQueue.unshift({
      ...entry,
      queuedAt: nowIso(),
    });
    this.fallbackQueue = this.fallbackQueue.slice(0, 200);
    this.saveFallbackQueue();
  }

  listFallbackQueue() {
    return [...this.fallbackQueue];
  }
}

const store = new IncidentStore();
export default store;
