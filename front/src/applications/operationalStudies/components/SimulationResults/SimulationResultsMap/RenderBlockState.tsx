import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';
import lineSliceAlong from '@turf/line-slice-along';
import { Feature, LineString } from 'geojson';
import { RootState } from 'reducers';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { TrainPosition } from './types';

function setCurrentBlockState(
  geojsonPath: Feature<LineString>,
  headDistance: number,
  tailDistance: number
) {
  const threshold = 0;
  if (headDistance - tailDistance > threshold) {
    return lineSliceAlong(geojsonPath, tailDistance, headDistance);
  }
  if (headDistance > threshold) {
    return lineSliceAlong(geojsonPath, headDistance - threshold, headDistance);
  }
  return lineSliceAlong(geojsonPath, 0, threshold);
}

function setPreviousBlockState(
  geojsonPath: Feature<LineString>,
  headDistance: number,
  tailDistance: number
) {
  const threshold = 0;
  if (headDistance - tailDistance > threshold) {
    return lineSliceAlong(geojsonPath, tailDistance, headDistance);
  }
  if (headDistance > threshold) {
    return lineSliceAlong(geojsonPath, headDistance - threshold, headDistance);
  }
  return lineSliceAlong(geojsonPath, 0, threshold);
}

interface RenderBlockStateProps {
  point: TrainPosition;
  geojsonPath: Feature<LineString>;
  layerOrder: number;
}

export default function RenderBlockState(props: RenderBlockStateProps) {
  const { point, geojsonPath, layerOrder } = props;
  const { selectedTrain } = useSelector((state: RootState) => state.osrdsimulation);
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const data = simulation.trains[selectedTrain].base.route_aspects;

  function getCurrentBlockState(
    // eslint-disable-next-line no-shadow
    geojsonPath: Feature<LineString>,
    blockStateStartPosition: number,
    blockStateEndPosition: number
  ) {
    let endOfBlock = data[blockStateStartPosition].position_start / 1000;
    let startOfBlock = data[blockStateEndPosition].position_start / 1000;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < geojsonPath.geometry.coordinates.length; i++) {
      if (blockStateStartPosition === data.length - 1) {
        break;
      }
      if (point.headDistanceAlong > endOfBlock) {
        blockStateStartPosition += 1;
        blockStateEndPosition += 1;
        endOfBlock = data[blockStateStartPosition].position_start / 1000;
        startOfBlock = data[blockStateEndPosition].position_start / 1000;
      }
    }
    const currentBlockState = setCurrentBlockState(geojsonPath, endOfBlock, startOfBlock);
    return [currentBlockState];
  }

  function getPreviousBlockState(
    // eslint-disable-next-line no-shadow
    geojsonPath: Feature<LineString>,
    blockStateStartPosition: number,
    blockStateEndPosition: number
  ) {
    let endOfBlock = data[blockStateStartPosition].position_start / 1000;
    let startOfBlock = data[blockStateEndPosition].position_start / 1000;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < geojsonPath.geometry.coordinates.length; i++) {
      if (blockStateStartPosition === data.length - 1) {
        break;
      }
      if (point.headDistanceAlong > data[blockStateStartPosition + 1].position_start / 1000) {
        blockStateStartPosition += 1;
        blockStateEndPosition += 1;
        endOfBlock = data[blockStateStartPosition - 1].position_start / 1000;
        startOfBlock = data[blockStateEndPosition - 1].position_start / 1000;
      }
    }
    const previousBlockState = setPreviousBlockState(geojsonPath, endOfBlock, startOfBlock);
    return [previousBlockState];
  }

  if (geojsonPath && point.headDistanceAlong && point.tailDistanceAlong) {
    const [currentBlockState] = getCurrentBlockState(geojsonPath, 1, 0);
    const [previousBlockState] = getPreviousBlockState(geojsonPath, 1, 0);
    const mergedData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: currentBlockState.geometry,
          properties: { ...currentBlockState.properties, type: 'current' },
        },
        {
          type: 'Feature',
          geometry: previousBlockState.geometry,
          properties: { ...previousBlockState.properties, type: 'previous' },
        },
      ],
    };
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
