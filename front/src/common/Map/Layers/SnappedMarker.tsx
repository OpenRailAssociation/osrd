import React from 'react';

import type { Feature, Point } from 'geojson';
import { Marker } from 'react-map-gl/maplibre';

const SnappedMarker = ({ geojson }: { geojson: Feature<Point> }) => (
  <Marker longitude={geojson.geometry.coordinates[0]} latitude={geojson.geometry.coordinates[1]}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      style={{ cursor: 'pointer' }}
    >
      <circle style={{ fill: '#0088ce' }} cx="16" cy="16" r="6" />
      <circle style={{ fill: '#ffffff' }} cx="16" cy="16" r="4" />
    </svg>
  </Marker>
);

export default SnappedMarker;
