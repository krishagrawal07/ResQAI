import express from 'express';
import hospitalService from '../services/hospitalService.js';
import notificationService from '../services/notificationService.js';
import store from '../services/store.js';
import {emitEvent} from '../socket.js';
import {evaluateSeverity} from '../utils/severity.js';

const incidentsRouter = express.Router();

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseLocation(input = {}) {
  return {
    lat: toNumber(input.lat),
    lng: toNumber(input.lng),
    address: input.address || '',
    speedKmh: toNumber(input.speedKmh || input.speed || 0),
  };
}

function hasValidLocation(location) {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng);
}

incidentsRouter.get('/', (request, response) => {
  const statusFilter = request.query.status;
  const data =
    statusFilter === 'active'
      ? store.listActiveIncidents()
      : store.listIncidents();

  response.json({
    incidents: data,
  });
});

incidentsRouter.get('/metrics', (_request, response) => {
  response.json(store.getMetrics());
});

incidentsRouter.get('/heatmap', (_request, response) => {
  response.json({
    points: store.getHeatmapPoints(),
  });
});

incidentsRouter.get('/fallback-queue', (_request, response) => {
  response.json({
    queue: store.listFallbackQueue(),
  });
});

incidentsRouter.get('/:id', (request, response) => {
  const incident = store.getIncident(request.params.id);

  if (!incident) {
    response.status(404).json({message: 'Incident not found'});
    return;
  }

  response.json({incident});
});

incidentsRouter.post('/', async (request, response) => {
  const {
    dispatchPreferences = {},
    emergencyPlan = {},
    metadata = {},
    mode = 'biker',
    sensorSnapshot = {},
    userProfile = {},
  } = request.body || {};
  const location = parseLocation(request.body?.location);

  if (!hasValidLocation(location)) {
    response.status(400).json({
      message: 'A valid location with latitude and longitude is required.',
    });
    return;
  }

  const severity = evaluateSeverity(sensorSnapshot, mode);
  const hospitals = hospitalService.findNearest(location.lat, location.lng, 3);

  const incident = store.createIncident({
    dispatchPreferences,
    emergencyPlan,
    location,
    metadata: {
      ...metadata,
      source: metadata?.source || 'mobile-app',
    },
    mode,
    sensorSnapshot,
    severity,
    userProfile,
  });

  const notifications =
    await notificationService.dispatchEmergencyNotifications(
      incident,
      hospitals,
    );

  const updatedIncident = store.updateIncident(incident.id, {
    hospitals,
    notifications,
  });

  emitEvent('incident:created', updatedIncident);
  emitEvent('incident:metrics', store.getMetrics());

  response.status(201).json({
    incident: updatedIncident,
  });
});

incidentsRouter.patch('/:id/location', (request, response) => {
  const {id} = request.params;
  const location = parseLocation(request.body || {});

  if (!hasValidLocation(location)) {
    response.status(400).json({
      message: 'A valid location update requires latitude and longitude.',
    });
    return;
  }

  const incident = store.addLocationPing(id, location);
  if (!incident) {
    response.status(404).json({message: 'Incident not found'});
    return;
  }

  emitEvent('incident:location', {
    incidentId: id,
    location: incident.location,
    updatedAt: incident.updatedAt,
  });

  response.json({incident});
});

incidentsRouter.patch('/:id/status', (request, response) => {
  const {id} = request.params;
  const status = request.body?.status;

  if (!status) {
    response.status(400).json({message: 'status is required'});
    return;
  }

  const incident = store.updateIncident(id, {status});
  if (!incident) {
    response.status(404).json({message: 'Incident not found'});
    return;
  }

  emitEvent('incident:updated', incident);
  emitEvent('incident:metrics', store.getMetrics());

  response.json({incident});
});

export default incidentsRouter;
