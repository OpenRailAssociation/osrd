import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { OSM_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface TracksOSMProps {
  colors: Theme;
  layerOrder: number;
}

function TracksOSM(props: TracksOSMProps) {
  const { showOSMtracksections } = useSelector((state: RootState) => state.map);
  const { colors, layerOrder } = props;

  const railwayMinor: LayerProps = {
    id: 'railwayMinor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['==', 'class', 'rail'], ['==', 'service', 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.minor,
    },
  };

  const railwayMajor: LayerProps = {
    id: 'railwayMajor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['==', 'class', 'rail'], ['!=', 'service', 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.major,
      'line-width': {
        stops: [
          [15, 1],
          [17, 3],
        ],
      },
    },
  };

  return showOSMtracksections ? (
    <Source id="tracksOSM" type="vector" url={OSM_URL} source-layer="transportation">
      <OrderedLayer {...railwayMinor} layerOrder={layerOrder} />
      <OrderedLayer {...railwayMajor} layerOrder={layerOrder} />
    </Source>
  ) : null;
}

export default TracksOSM;
