import express from 'express';
import store from '../services/store.js';

const publicRouter = express.Router();

publicRouter.get('/live/:shareToken', (request, response) => {
  const incident = store.getIncidentByShareToken(request.params.shareToken);

  if (!incident) {
    response.status(404).json({message: 'Tracking token not found'});
    return;
  }

  response.json({
    incident: {
      createdAt: incident.createdAt,
      id: incident.id,
      lastLocation: incident.location,
      locationHistory: incident.locationHistory,
      mapsUrl: incident.mapsUrl,
      severity: incident.severity,
      status: incident.status,
      trackingUrl: incident.trackingUrl,
      user: {
        bloodGroup:
          incident.emergencyPlan?.bloodGroup ||
          incident.userProfile?.bloodGroup ||
          'Unknown',
        medicalNotes:
          incident.emergencyPlan?.medicalNotes ||
          incident.userProfile?.medicalNotes ||
          '',
        name: incident.userProfile?.name || 'Unknown driver',
      },
    },
  });
});

export default publicRouter;
