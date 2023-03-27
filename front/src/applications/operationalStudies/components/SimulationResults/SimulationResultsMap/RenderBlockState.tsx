import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';
import lineSliceAlong from '@turf/line-slice-along';
import { featureCollection } from '@turf/helpers';
import { Feature, LineString } from 'geojson';
import { isFinite } from 'lodash';

import { RouteAspect } from 'reducers/osrdsimulation/types';
import { getSelectedTrain, getPresentSimulation } from 'reducers/osrdsimulation/selectors';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { TrainPosition } from './types';

function blockState(
  geojsonPath: Feature<LineString>,
  headDistance: number,
  tailDistance: number,
  type: string
) {
  const threshold = 0.000001;
  let newLineString = lineSliceAlong(geojsonPath, 0, threshold);
  if (isFinite(headDistance) && isFinite(tailDistance)) {
    if (headDistance - tailDistance > threshold) {
      newLineString = lineSliceAlong(geojsonPath, tailDistance, headDistance);
    } else if (headDistance > threshold) {
      newLineString = lineSliceAlong(geojsonPath, headDistance - threshold, headDistance);
    }
  }
  newLineString.properties = { ...newLineString.properties, type };
  return newLineString;
}

function getPositionStart(data: RouteAspect[], blockIndex: number) {
  return data?.[blockIndex]?.position_start / 1000;
}

interface RenderBlockStateProps {
  point: TrainPosition;
  geojsonPath: Feature<LineString>;
  layerOrder: number;
}

export default function RenderBlockState(props: RenderBlockStateProps) {
  const { point, geojsonPath, layerOrder } = props;
  const selectedTrain = useSelector(getSelectedTrain);
  const simulation = useSelector(getPresentSimulation);
  const data = simulation.trains[selectedTrain].base.route_aspects;

  function getCurrentBlockState(
    // eslint-disable-next-line no-shadow
    geojsonPath: Feature<LineString>,
    blockStateStartIndex: number,
    blockStateEndIndex: number
  ) {
    let endOfBlock = getPositionStart(data, blockStateStartIndex);
    let startOfBlock = getPositionStart(data, blockStateEndIndex);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < geojsonPath.geometry.coordinates.length; i++) {
      if (blockStateStartIndex === data?.length - 1) {
        break;
      }
      if (point.headDistanceAlong > endOfBlock) {
        blockStateStartIndex += 1;
        blockStateEndIndex += 1;
        endOfBlock = getPositionStart(data, blockStateStartIndex);
        startOfBlock = getPositionStart(data, blockStateEndIndex);
      }
    }
    const currentBlockState = blockState(geojsonPath, endOfBlock, startOfBlock, 'current');
    return [currentBlockState];
  }

  function getPreviousBlockState(
    // eslint-disable-next-line no-shadow
    geojsonPath: Feature<LineString>,
    blockStateStartIndex: number,
    blockStateEndIndex: number
  ) {
    let endOfBlock = getPositionStart(data, blockStateStartIndex);
    let startOfBlock = getPositionStart(data, blockStateEndIndex);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < geojsonPath.geometry.coordinates.length; i++) {
      if (blockStateStartIndex === data?.length - 1) {
        break;
      }
      if (point.headDistanceAlong > getPositionStart(data, blockStateStartIndex + 1)) {
        blockStateStartIndex += 1;
        blockStateEndIndex += 1;
        endOfBlock = getPositionStart(data, blockStateStartIndex - 1);
        startOfBlock = getPositionStart(data, blockStateEndIndex - 1);
      }
    }
    const previousBlockState = blockState(geojsonPath, endOfBlock, startOfBlock, 'previous');
    return [previousBlockState];
  }

  if (geojsonPath && point.headDistanceAlong && point.tailDistanceAlong) {
    const [currentBlockState] = getCurrentBlockState(geojsonPath, 1, 0);
    const [previousBlockState] = getPreviousBlockState(geojsonPath, 1, 0);
    const mergedData = featureCollection([currentBlockState, previousBlockState]);
    return (
      <Source type="geojson" data={mergedData}>
        <OrderedLayer
          type="line"
          filter={['==', 'type', 'current']}
          paint={{
            'line-width': 3,
            'line-color': '#cd0037',
          }}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          type="line"
          filter={['==', 'type', 'previous']}
          paint={{
            'line-width': 3,
            'line-color': '#ffb612',
          }}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
