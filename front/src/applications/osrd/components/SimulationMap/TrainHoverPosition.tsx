import React from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source, Marker, LayerProps } from 'react-map-gl';
import lineSliceAlong from '@turf/line-slice-along';
import length from '@turf/length';
import { Feature, LineString } from 'geojson';
import cx from 'classnames';

import { RootState } from 'reducers';
import { datetime2time } from 'utils/timeManipulation';
import { boundedValue } from 'utils/numbers';
import { Viewport } from 'reducers/map';
import { TrainPosition } from './types';

function getFill(isSelectedTrain: boolean, ecoBlocks) {
  if (isSelectedTrain) {
    return ecoBlocks ? '#82be00' : '#303383';
  }
  return '#333';
}

function getSpeedAndTimeLabel(isSelectedTrain, ecoBlocks, point: TrainPosition) {
  if (isSelectedTrain) {
    return (
      <>
        <span
          className={cx('small', 'font-weight-bold', ecoBlocks ? 'text-secondary' : 'text-primary')}
        >
          {Math.round(point?.speedTime?.speed ?? 0)}
          km/h
        </span>
        <span className="ml-2 small">{point.speedTime && datetime2time(point.speedTime.time)}</span>
      </>
    );
  }
  return (
    <>
      {/* <small>{point.properties.name}</small> */}
      <span className="small ml-1 font-weight-bold text-muted">
        {Math.round(point?.speedTime?.speed)}
        km/h
      </span>
    </>
  );
}

// When the train is backward, lineSliceAlong will crash. we need to have head and tail in the right order
export function makeDisplayedHeadAndTail(point: TrainPosition, geojsonPath: Feature<LineString>) {
  const pathLength = length(geojsonPath);
  const trueHead = Math.max(point.tailDistanceAlong, point.headDistanceAlong);
  const trueTail = Math.min(point.tailDistanceAlong, point.headDistanceAlong);
  const boundedHead = boundedValue(trueHead, 0, pathLength);
  const boundedTail = boundedValue(trueTail, 0, pathLength);
  const middle = (boundedHead + boundedTail) / 2;
  return {
    head: boundedHead,
    middle,
    tail: boundedTail,
  };
}

function getLengthFactorToKeepLabelPlacedCorrectlyWhenZooming(viewport: Viewport, threshold = 12) {
  return 2 ** (threshold - viewport?.zoom);
}

interface TrainHoverPositionProps {
  point: TrainPosition;
  isSelectedTrain?: boolean;
  geojsonPath: Feature<LineString>;
}

export function getBufferStopsLayerProps(params: { sourceTable?: string }): LayerProps {
  const res: LayerProps = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': ['slice', ['get', 'id'], 11],
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'icon-image': 'HEURTOIR',
      'icon-size': 0.2,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'viewport',
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'text-allow-overlap': false,
      visibility: 'visible',
    },
    paint: {
      'text-color': '#555',
      'text-halo-width': 2,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

const shiftFactor = {
  long: 1 / 450,
  lat: 1 / 1000,
};
function TrainHoverPosition(props: TrainHoverPositionProps) {
  const { point, isSelectedTrain, geojsonPath } = props;
  const { selectedTrain, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const { viewport } = useSelector((state: RootState) => state.map);
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const { ecoBlocks } = allowancesSettings[trainID];
  const fill = getFill(isSelectedTrain as boolean, ecoBlocks);
  const label = getSpeedAndTimeLabel(isSelectedTrain, ecoBlocks, point);

  if (geojsonPath && point.headDistanceAlong && point.tailDistanceAlong) {
    const zoomLengthFactor = getLengthFactorToKeepLabelPlacedCorrectlyWhenZooming(viewport);
    const { tail, middle, head } = makeDisplayedHeadAndTail(point, geojsonPath);
    console.log(tail, middle, head);
    const train1GeoJsonPath = lineSliceAlong(geojsonPath, tail, middle);
    const train2GeoJsonPath = lineSliceAlong(geojsonPath, middle, head);

    return (
      <>
        <Marker
          className="map-search-marker"
          longitude={
            point.headPosition.geometry.coordinates[0] + zoomLengthFactor * shiftFactor.long
          }
          latitude={point.headPosition.geometry.coordinates[1] + zoomLengthFactor * shiftFactor.lat}
        >
          {label}
        </Marker>
        <Source type="geojson" data={train1GeoJsonPath}>
          <Layer
            id={`${point.id}-path-1`}
            type="line"
            paint={{
              'line-width': 8,
              'line-color': 'blue',
            }}
            layout={{
              'line-cap': 'square',
            }}
          />
        </Source>
        <Source type="geojson" data={train2GeoJsonPath}>
          <Layer
            id={`${point.id}-path-2`}
            type="line"
            paint={{
              'line-width': 8,
              'line-color': 'blue',
            }}
            layout={{
              'line-cap': 'butt',
            }}
          />
        </Source>
        <Source type="vector">
          <Layer {...getBufferStopsLayerProps({ sourceTable: 'buffer_stops' })} />
        </Source>
      </>
    );
  }
  return null;
}

export default TrainHoverPosition;
