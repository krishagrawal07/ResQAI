const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
).replace(/\/+$/, '');

function toSocketBaseUrl() {
  return API_BASE_URL.replace(/\/api$/, '');
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  return payload;
}

export async function fetchActiveIncidents() {
  const data = await apiRequest('/incidents?status=active');
  return data.incidents || [];
}

export async function fetchMetrics() {
  return apiRequest('/incidents/metrics');
}

export async function fetchHeatmapPoints() {
  const data = await apiRequest('/incidents/heatmap');
  return data.points || [];
}

export async function fetchTrackingToken(shareToken) {
  const data = await apiRequest(`/live/${shareToken}`);
  return data.incident;
}

export async function updateIncidentStatus(incidentId, status) {
  const data = await apiRequest(`/incidents/${incidentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({status}),
  });
  return data.incident;
}

export function getMapboxToken() {
  return import.meta.env.VITE_MAPBOX_TOKEN || '';
}

export {API_BASE_URL, toSocketBaseUrl};
