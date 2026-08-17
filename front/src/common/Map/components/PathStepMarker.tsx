import { useEffect, useState } from 'react';

import { Turnaround } from '@osrd-project/ui-icons';
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
  name?: string;
  coordinates: Position;
  testId?: string;
  markerState?: PATH_STEP_MARKER_STATE;
  draggable?: boolean;
  isSelected?: boolean;
  isBackTrack?: boolean;
  resetKey?: number;
  onDragStart?: () => void;
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
};

const PathStepMarker = ({
  id,
  markerIndicator,
  name,
  coordinates,
  testId,
  markerState = PATH_STEP_MARKER_STATE.REST,
  draggable,
  isSelected,
  isBackTrack,
  resetKey,
  onDragStart,
  onDrag,
  onDragEnd,
}: PathStepsMarkerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    setPendingPosition(null);
  }, [coordinates, resetKey]);

  const effectiveCoordinates = pendingPosition ?? coordinates;
  const effectiveMarkerState = isDragging ? PATH_STEP_MARKER_STATE.ACTIVE : markerState;

  return (
    <Marker
      longitude={effectiveCoordinates[0]}
      latitude={effectiveCoordinates[1]}
      offset={[0, -20]}
      key={id}
      draggable={draggable}
      style={isSelected ? { zIndex: 1 } : { zIndex: 0 }}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart?.();
      }}
      onDrag={(e) => {
        setPendingPosition([e.lngLat.lng, e.lngLat.lat]);
        onDrag?.(e.lngLat);
      }}
      onDragEnd={(e) => {
        setIsDragging(false);
        setPendingPosition([e.lngLat.lng, e.lngLat.lat]);
        onDragEnd?.(e.lngLat);
      }}
    >
      <div
        className={cx('path-step-marker', { draggable, dragging: isDragging })}
        data-testid={testId}
      >
        <img src={MARKER_IMAGES[effectiveMarkerState]} alt={MARKER_IMAGES[effectiveMarkerState]} />
        <span className={cx('indicator', effectiveMarkerState)}>{markerIndicator}</span>
        {name && (
          <div className="label">
            {isBackTrack && (
              <span className="backtrack-icon">
                <Turnaround />
              </span>
            )}
            {name}
          </div>
        )}
      </div>
    </Marker>
  );
};

export default PathStepMarker;
