import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Map, {Marker} from 'react-map-gl';
import {io} from 'socket.io-client';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  fetchActiveIncidents,
  fetchHeatmapPoints,
  fetchMetrics,
  fetchTrackingToken,
  getMapboxToken,
  toSocketBaseUrl,
  updateIncidentStatus,
} from './api';

const SEVERITY_COLORS = {
  Critical: '#ff5252',
  Low: '#ffd166',
  Medium: '#ff9f43',
};

const SEVERITY_OPTIONS = ['All', 'Critical', 'Medium', 'Low'];

const SORT_OPTIONS = [
  {label: 'Newest first', value: 'newest'},
  {label: 'Highest severity', value: 'severity'},
  {label: 'Recently updated', value: 'updated'},
];

const MAP_STYLE_OPTIONS = [
  {label: 'Night Ops', value: 'mapbox://styles/mapbox/dark-v11'},
  {label: 'Street View', value: 'mapbox://styles/mapbox/streets-v12'},
  {label: 'Satelite Hybrid', value: 'mapbox://styles/mapbox/satellite-streets-v12'},
];

const MAP_VIEW_STYLE = {height: 420, width: '100%'};

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function rankSeverity(label = 'Low') {
  if (label === 'Critical') {
    return 3;
  }
  if (label === 'Medium') {
    return 2;
  }
  return 1;
}

function sortByNewest(items = []) {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt || 0).getTime() -
      new Date(left.createdAt || 0).getTime(),
  );
}

function normalizeActiveIncidents(items = []) {
  return sortByNewest(
    items.filter(item => (item.status || 'active') === 'active'),
  );
}

function upsertActiveIncident(items, incoming) {
  if (!incoming?.id) {
    return items;
  }

  if ((incoming.status || 'active') !== 'active') {
    return items.filter(item => item.id !== incoming.id);
  }

  const exists = items.some(item => item.id === incoming.id);
  const next = exists
    ? items.map(item => (item.id === incoming.id ? incoming : item))
    : [incoming, ...items];
  return sortByNewest(next);
}

function DashboardPage() {
  const [incidents, setIncidents] = useState([]);
  const [metrics, setMetrics] = useState({
    active: 0,
    severity: {Critical: 0, Low: 0, Medium: 0},
    total: 0,
  });
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [livePaused, setLivePaused] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState('');
  const [mapStyle, setMapStyle] = useState(MAP_STYLE_OPTIONS[0].value);
  const livePausedRef = useRef(false);
  const mapboxToken = getMapboxToken();

  useEffect(() => {
    livePausedRef.current = livePaused;
  }, [livePaused]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setToastMessage('');
    }, 2800);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadDashboardData = useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setErrorMessage('');

    try {
      const [incidentData, metricsData, heatmapData] = await Promise.all([
        fetchActiveIncidents(),
        fetchMetrics(),
        fetchHeatmapPoints(),
      ]);

      const activeIncidents = normalizeActiveIncidents(incidentData);
      setIncidents(activeIncidents);
      setMetrics(metricsData);
      setHeatmapPoints(heatmapData || []);
      setSelectedIncidentId(current => {
        if (current && activeIncidents.some(item => item.id === current)) {
          return current;
        }

        return activeIncidents[0]?.id || '';
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      if (initialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboardData(true);
  }, [loadDashboardData]);

  useEffect(() => {
    const socket = io(toSocketBaseUrl(), {
      transports: ['websocket'],
    });

    socket.on('incident:created', incident => {
      if (livePausedRef.current) {
        return;
      }

      setIncidents(current => upsertActiveIncident(current, incident));
      setSelectedIncidentId(current => current || incident.id);
      setHeatmapPoints(current => [
        {
          id: incident.id,
          intensity: incident.severity?.score || 25,
          lat: incident.location?.lat || 0,
          lng: incident.location?.lng || 0,
          severity: incident.severity?.label || 'Low',
          timestamp: incident.createdAt,
        },
        ...current,
      ]);
    });

    socket.on('incident:updated', incident => {
      if (livePausedRef.current) {
        return;
      }

      setIncidents(current => upsertActiveIncident(current, incident));
    });

    socket.on('incident:location', update => {
      if (livePausedRef.current) {
        return;
      }

      setIncidents(current =>
        current.map(item =>
          item.id === update.incidentId
            ? {
                ...item,
                location: {
                  ...item.location,
                  ...update.location,
                },
                updatedAt: update.updatedAt,
              }
            : item,
        ),
      );
    });

    socket.on('incident:metrics', nextMetrics => {
      if (livePausedRef.current) {
        return;
      }

      setMetrics(nextMetrics);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const visibleIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = incidents.filter(incident => {
      const severityLabel = incident.severity?.label || 'Low';
      const severityMatch =
        severityFilter === 'All' || severityFilter === severityLabel;
      const text = [
        incident.id,
        incident.userProfile?.name,
        incident.location?.address,
        incident.locationLabel,
      ]
        .join(' ')
        .toLowerCase();
      const queryMatch = !query || text.includes(query);
      return severityMatch && queryMatch;
    });

    if (sortMode === 'severity') {
      return [...filtered].sort((left, right) => {
        const rankDelta =
          rankSeverity(right.severity?.label) - rankSeverity(left.severity?.label);
        if (rankDelta !== 0) {
          return rankDelta;
        }
        return (
          new Date(right.createdAt || 0).getTime() -
          new Date(left.createdAt || 0).getTime()
        );
      });
    }

    if (sortMode === 'updated') {
      return [...filtered].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
      );
    }

    return sortByNewest(filtered);
  }, [incidents, searchQuery, severityFilter, sortMode]);

  useEffect(() => {
    if (visibleIncidents.length === 0) {
      if (selectedIncidentId) {
        setSelectedIncidentId('');
      }
      return;
    }

    if (!visibleIncidents.some(item => item.id === selectedIncidentId)) {
      setSelectedIncidentId(visibleIncidents[0].id);
    }
  }, [selectedIncidentId, visibleIncidents]);

  const selectedIncident = useMemo(
    () =>
      visibleIncidents.find(item => item.id === selectedIncidentId) ||
      visibleIncidents[0] ||
      null,
    [selectedIncidentId, visibleIncidents],
  );

  const selectedPoint = selectedIncident?.location || {
    lat: 20.5937,
    lng: 78.9629,
  };

  const visibleHeatmapPoints = useMemo(() => {
    const filtered =
      severityFilter === 'All'
        ? heatmapPoints
        : heatmapPoints.filter(point => (point.severity || 'Low') === severityFilter);
    return filtered.slice(0, 30);
  }, [heatmapPoints, severityFilter]);

  const metricCards = [
    {label: 'Total Incidents', value: metrics.total},
    {label: 'Active Rescue Events', value: metrics.active},
    {label: 'Critical Alerts', value: metrics.severity.Critical},
    {label: 'Medium Alerts', value: metrics.severity.Medium},
    {label: 'Visible In Feed', value: visibleIncidents.length},
  ];

  const handleRefresh = useCallback(async () => {
    await loadDashboardData(false);
    setToastMessage('Dashboard data refreshed.');
  }, [loadDashboardData]);

  const handleLiveToggle = useCallback(async () => {
    const nextLivePaused = !livePaused;
    setLivePaused(nextLivePaused);
    setToastMessage(nextLivePaused ? 'Live updates paused.' : 'Live updates resumed.');

    if (!nextLivePaused) {
      await loadDashboardData(false);
    }
  }, [livePaused, loadDashboardData]);

  const handleCopyTrackingLink = useCallback(async url => {
    if (!url) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        window.prompt('Copy tracking link:', url);
        return;
      }

      await navigator.clipboard.writeText(url);
      setToastMessage('Tracking link copied.');
    } catch (error) {
      window.prompt('Copy tracking link:', url);
    }
  }, []);

  const handleResolveIncident = useCallback(async () => {
    if (!selectedIncident?.id) {
      return;
    }

    setStatusUpdating('resolved');
    setErrorMessage('');

    try {
      const updatedIncident = await updateIncidentStatus(
        selectedIncident.id,
        'resolved',
      );
      setIncidents(current => upsertActiveIncident(current, updatedIncident));
      const nextMetrics = await fetchMetrics();
      setMetrics(nextMetrics);
      setToastMessage('Incident marked as resolved.');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setStatusUpdating('');
    }
  }, [selectedIncident?.id]);

  return (
    <div className="shell">
      <header className="hero animate-rise" style={{'--delay': '0.04s'}}>
        <div>
          <h1>ResQ AI Command Dashboard</h1>
          <p>
            Coordinate incident response with live telemetry, map intelligence,
            and one-click rescue actions.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className={`pill-button ${livePaused ? 'warn' : 'ok'}`}
            onClick={handleLiveToggle}
            type="button">
            {livePaused ? 'Live Paused' : 'Live Running'}
          </button>
          <button
            className="pill-button neutral"
            disabled={refreshing}
            onClick={handleRefresh}
            type="button">
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {toastMessage ? (
        <div className="toast-banner animate-rise" style={{'--delay': '0.08s'}}>
          {toastMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="error-banner animate-rise" style={{'--delay': '0.1s'}}>
          {errorMessage}
        </div>
      ) : null}

      <section className="control-grid animate-rise" style={{'--delay': '0.12s'}}>
        <label className="control search-control">
          <span>Search Incident</span>
          <input
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search by user, id, or address"
            type="text"
            value={searchQuery}
          />
        </label>

        <div className="control">
          <span>Severity Filter</span>
          <div className="segmented">
            {SEVERITY_OPTIONS.map(option => (
              <button
                className={severityFilter === option ? 'active' : ''}
                key={option}
                onClick={() => setSeverityFilter(option)}
                type="button">
                {option}
              </button>
            ))}
          </div>
        </div>

        <label className="control compact-control">
          <span>Sort Feed</span>
          <select
            className="select-input"
            onChange={event => setSortMode(event.target.value)}
            value={sortMode}>
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {mapboxToken ? (
          <label className="control compact-control">
            <span>Map Theme</span>
            <select
              className="select-input"
              onChange={event => setMapStyle(event.target.value)}
              value={mapStyle}>
              {MAP_STYLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="metrics-grid animate-rise" style={{'--delay': '0.15s'}}>
        {metricCards.map(item => (
          <article key={item.label} className="metric-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid animate-rise" style={{'--delay': '0.19s'}}>
        <article className="panel map-panel">
          <div className="panel-header">
            <h2>Active Incident Map</h2>
            <p>
              Showing {visibleIncidents.length} incident
              {visibleIncidents.length === 1 ? '' : 's'} from current filters.
            </p>
          </div>

          {mapboxToken ? (
            <Map
              key={`${selectedIncident?.id || 'default'}-${mapStyle}`}
              initialViewState={{
                latitude: selectedPoint.lat,
                longitude: selectedPoint.lng,
                zoom: selectedIncident ? 12 : 4.6,
              }}
              mapStyle={mapStyle}
              mapboxAccessToken={mapboxToken}
              style={MAP_VIEW_STYLE}>
              {visibleIncidents.map(incident => (
                <Marker
                  key={incident.id}
                  latitude={incident.location?.lat || 0}
                  longitude={incident.location?.lng || 0}>
                  <button
                    className="marker"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    style={{
                      '--marker-color':
                        SEVERITY_COLORS[incident.severity?.label || 'Low'] ||
                        '#ffd166',
                    }}
                    type="button"
                  />
                </Marker>
              ))}
            </Map>
          ) : (
            <div className="map-fallback">
              <h3>Mapbox token missing</h3>
              <p>
                Add <code>VITE_MAPBOX_TOKEN</code> in <code>dashboard/.env</code>{' '}
                to enable the live map.
              </p>
              <ul className="fallback-list">
                {visibleIncidents.map(item => (
                  <li key={item.id}>
                    <button
                      className="fallback-item"
                      onClick={() => setSelectedIncidentId(item.id)}
                      type="button">
                      <strong>{item.userProfile?.name || 'Unknown user'}</strong>
                      <span>
                        {Number(item.location?.lat || 0).toFixed(4)},{' '}
                        {Number(item.location?.lng || 0).toFixed(4)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Incident Feed</h2>
            <p>Use filters to focus the response queue instantly.</p>
          </div>
          <div className="incident-list">
            {visibleIncidents.length === 0 ? (
              <div className="empty-state">
                No active incidents match your current filters.
              </div>
            ) : (
              visibleIncidents.map((incident, index) => (
                <button
                  key={incident.id}
                  className={`incident-item ${
                    selectedIncident?.id === incident.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  style={{'--item-delay': `${Math.min(index * 40, 440)}ms`}}
                  type="button">
                  <div className="incident-head">
                    <strong>{incident.userProfile?.name || 'Unknown User'}</strong>
                    <span
                      className="badge"
                      style={{
                        background:
                          SEVERITY_COLORS[incident.severity?.label || 'Low'] ||
                          '#ffd166',
                      }}>
                      {incident.severity?.label || 'Low'}
                    </span>
                  </div>
                  <p>{incident.location?.address || incident.locationLabel}</p>
                  <small>{formatDate(incident.updatedAt || incident.createdAt)}</small>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel-grid animate-rise" style={{'--delay': '0.24s'}}>
        <article className="panel">
          <div className="panel-header">
            <h2>Selected Incident Details</h2>
            <p>Brief responders and close the incident from one place.</p>
          </div>

          {selectedIncident ? (
            <div className="details-stack">
              <div className="detail-row">
                <span>ID</span>
                <strong>{selectedIncident.id}</strong>
              </div>
              <div className="detail-row">
                <span>User</span>
                <strong>{selectedIncident.userProfile?.name || 'Unknown'}</strong>
              </div>
              <div className="detail-row">
                <span>Status</span>
                <strong className="status-chip">{selectedIncident.status || 'active'}</strong>
              </div>
              <div className="detail-row">
                <span>Blood Group</span>
                <strong>
                  {selectedIncident.emergencyPlan?.bloodGroup ||
                    selectedIncident.userProfile?.bloodGroup ||
                    'Unknown'}
                </strong>
              </div>
              <div className="detail-row">
                <span>Tracking Link</span>
                <div className="detail-inline-actions">
                  {selectedIncident.trackingUrl ? (
                    <a
                      href={selectedIncident.trackingUrl}
                      rel="noreferrer"
                      target="_blank">
                      Open live tracker
                    </a>
                  ) : (
                    <strong>Unavailable</strong>
                  )}
                  <button
                    className="inline-button"
                    disabled={!selectedIncident.trackingUrl}
                    onClick={() => handleCopyTrackingLink(selectedIncident.trackingUrl)}
                    type="button">
                    Copy
                  </button>
                </div>
              </div>
              <div className="detail-row">
                <span>Hospital Targets</span>
                <strong>{selectedIncident.hospitals?.length || 0}</strong>
              </div>
              <div className="detail-row column">
                <span>AI Reasons</span>
                <ul className="reason-list">
                  {(selectedIncident.severity?.reasons || []).map(reason => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="detail-actions-row">
                <button
                  className="action-button resolve"
                  disabled={statusUpdating === 'resolved'}
                  onClick={handleResolveIncident}
                  type="button">
                  {statusUpdating === 'resolved'
                    ? 'Resolving Incident...'
                    : 'Mark as Resolved'}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Pick an incident to inspect details.
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Crash Heatmap</h2>
            <p>Severity weighted hotspots for dispatcher awareness.</p>
          </div>
          <div className="heatmap-grid">
            {visibleHeatmapPoints.length === 0 ? (
              <div className="empty-state">No points yet.</div>
            ) : (
              visibleHeatmapPoints.map((point, index) => {
                const color = SEVERITY_COLORS[point.severity] || '#ffd166';
                const opacity = Math.max(0.2, (point.intensity || 0) / 100);
                return (
                  <article
                    key={`${point.id}-${index}`}
                    className="heat-point"
                    style={{
                      '--heat-delay': `${Math.min(index * 36, 420)}ms`,
                      borderColor: `${color}AA`,
                      boxShadow: `0 0 0 1px ${color}55 inset`,
                      background: `linear-gradient(145deg, ${color}${Math.round(
                        opacity * 255,
                      )
                        .toString(16)
                        .padStart(2, '0')} 0%, #101d31 100%)`,
                    }}>
                    <strong>{point.severity}</strong>
                    <span>Intensity {point.intensity}</span>
                    <small>
                      {Number(point.lat).toFixed(3)}, {Number(point.lng).toFixed(3)}
                    </small>
                  </article>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function TrackingPage({shareToken}) {
  const [incident, setIncident] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchTrackingToken(shareToken);
        if (active) {
          setIncident(data);
          setErrorMessage('');
          setLastSyncedAt(new Date().toISOString());
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message);
        }
      }
    };

    load();
    const timer = setInterval(load, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [shareToken]);

  return (
    <div className="shell tracking-shell">
      <header className="hero animate-rise" style={{'--delay': '0.05s'}}>
        <div>
          <h1>ResQ AI Live Tracking</h1>
          <p>
            Share this page with family and responders for live incident
            updates and location checkpoints.
          </p>
        </div>
        <div className="status-pill ok">Auto-sync every 5s</div>
      </header>

      {errorMessage ? (
        <div className="error-banner animate-rise" style={{'--delay': '0.1s'}}>
          {errorMessage}
        </div>
      ) : null}

      {incident ? (
        <section className="panel animate-rise" style={{'--delay': '0.14s'}}>
          <div className="panel-header">
            <h2>Status: {incident.status}</h2>
            <p>
              Severity {incident.severity?.label || 'Low'} | Last sync{' '}
              {lastSyncedAt ? formatDate(lastSyncedAt) : 'just now'}
            </p>
          </div>
          <div className="details-stack">
            <div className="detail-row">
              <span>Last Location</span>
              <strong>
                {incident.lastLocation?.lat?.toFixed(5)},{' '}
                {incident.lastLocation?.lng?.toFixed(5)}
              </strong>
            </div>
            <div className="detail-row">
              <span>Maps</span>
              {incident.mapsUrl ? (
                <a href={incident.mapsUrl} rel="noreferrer" target="_blank">
                  Open Google Maps
                </a>
              ) : (
                <strong>Unavailable</strong>
              )}
            </div>
            <div className="detail-row">
              <span>User</span>
              <strong>{incident.user?.name || 'Unknown'}</strong>
            </div>
            <div className="detail-row column">
              <span>Medical Notes</span>
              <strong>{incident.user?.medicalNotes || 'None provided'}</strong>
            </div>
          </div>
        </section>
      ) : (
        <div className="panel empty-state animate-rise" style={{'--delay': '0.14s'}}>
          Loading tracking details...
        </div>
      )}
    </div>
  );
}

export default function App() {
  const pathname = window.location.pathname;

  if (pathname.startsWith('/track/')) {
    const shareToken = pathname.replace('/track/', '').split('/')[0];
    return <TrackingPage shareToken={shareToken} />;
  }

  return <DashboardPage />;
}
