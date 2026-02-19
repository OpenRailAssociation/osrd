import { useState } from 'react';

import cx from 'classnames';
import type { Position } from 'geojson';
import { Marker } from 'react-map-gl/maplibre';

import activeSVG from 'assets/pictures/mapMarkers/active.svg';
import hoverSVG from 'assets/pictures/mapMarkers/hover.svg';
import restSVG from 'assets/pictures/mapMarkers/rest.svg';
import reverseSVG from 'assets/pictures/mapMarkers/reverse.svg';
import selectedSVG from 'assets/pictures/mapMarkers/selected.svg';

export type PathStepMarkerInformation = {
  name: string;
  coordinates: Position;
};

export enum PATH_STEP_MARKER_STATE {
  REST = 'rest',
  HOVER = 'hover',
  ACTIVE = 'active',
  SELECTED = 'selected',
  REVERSE = 'reverse',
}

const MARKER_IMAGES = {
  [PATH_STEP_MARKER_STATE.REST]: restSVG,
  [PATH_STEP_MARKER_STATE.HOVER]: hoverSVG,
  [PATH_STEP_MARKER_STATE.ACTIVE]: activeSVG,
  [PATH_STEP_MARKER_STATE.SELECTED]: selectedSVG,
  [PATH_STEP_MARKER_STATE.REVERSE]: reverseSVG,
};

export type PathStepsMarkerProps = {
  id: string;
  markerIndicator: string;
  name: string;
  coordinates: Position;
  markerState?: PATH_STEP_MARKER_STATE;
  draggable?: boolean;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
};

const PathStepMarker = ({
  id,
  markerIndicator,
  name,
  coordinates,
  markerState = PATH_STEP_MARKER_STATE.REST,
  draggable,
  onDragEnd,
}: PathStepsMarkerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const effectiveMarkerState = isDragging ? PATH_STEP_MARKER_STATE.ACTIVE : markerState;

  return (
    <Marker
      longitude={coordinates[0]}
      latitude={coordinates[1]}
      offset={[0, -20]}
      key={id}
      draggable={draggable}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e) => {
        setIsDragging(false);
        onDragEnd?.(e.lngLat);
      }}
    >
      <div className="path-step-marker">
        <img src={MARKER_IMAGES[effectiveMarkerState]} alt={MARKER_IMAGES[effectiveMarkerState]} />
        <span className={cx('indicator', effectiveMarkerState)}>{markerIndicator}</span>
        <div className="label">{name}</div>
      </div>
    </Marker>
  );
};

export default PathStepMarker;
