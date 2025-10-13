import type { Position } from 'geojson';
import { Marker } from 'react-map-gl/maplibre';

import hoverSVG from 'assets/pictures/mapMarkers/hover.svg';
import restSVG from 'assets/pictures/mapMarkers/rest.svg';

export type PathStepMarkerInformation = {
  name: string;
  coordinates: Position;
};

enum PATH_STEP_MARKER_STATE {
  REST = 'rest',
  HOVER = 'hover',
  ACTIVE = 'active',
  SELECTED = 'selected',
  REVERSE = 'reverse',
}

const MARKER_IMAGES = {
  // TODO : add other images on the map interaction issue
  [PATH_STEP_MARKER_STATE.REST]: restSVG,
  [PATH_STEP_MARKER_STATE.HOVER]: hoverSVG,
};

type PathStepsMarkerProps = {
  id: string;
  markerIndicator: string;
  name: string;
  coordinates: Position;
};

const PathStepMarker = ({ id, markerIndicator, name, coordinates }: PathStepsMarkerProps) => (
  <Marker longitude={coordinates[0]} latitude={coordinates[1]} offset={[0, -20]} key={id}>
    <div className="path-step-marker">
      <img
        src={MARKER_IMAGES[PATH_STEP_MARKER_STATE.REST]}
        alt={MARKER_IMAGES[PATH_STEP_MARKER_STATE.REST]}
      />

      <span className="indicator">{markerIndicator}</span>
      <div className="label">{name}</div>
    </div>
  </Marker>
);

export default PathStepMarker;
