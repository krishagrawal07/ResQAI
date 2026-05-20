import React from 'react';
import Map, {Marker} from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAP_VIEW_STYLE = {height: 420, width: '100%'};

export default function IncidentMap({
  mapStyle,
  mapboxToken,
  selectedIncident,
  selectedPoint,
  severityColors,
  setSelectedIncidentId,
  visibleIncidents,
}) {
  return (
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
                severityColors[incident.severity?.label || 'Low'] || '#ffd166',
            }}
            type="button"
          />
        </Marker>
      ))}
    </Map>
  );
}
