import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, CircleLayer, SymbolLayer } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

export function getDetectorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<CircleLayer, 'id'> {
  const res: Omit<CircleLayer, 'id'> = {
    type: 'circle',
    paint: {
      'circle-stroke-color': params.colors.detectors.circle,
      'circle-color': params.colors.detectors.circle,
      'circle-radius': 3,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getDetectorsNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    layout: {
      'text-field': ['slice', ['get', 'id'], 9],
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.1],
      visibility: 'visible',
    },
    paint: {
      'text-color': params.colors.detectors.text,
      'text-halo-width': 1,
      'text-halo-color': params.colors.detectors.halo,
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

interface DetectorsProps {
  colors: Theme;
  geomType: string;
  layerOrder: number;
}

const Detectors: FC<DetectorsProps> = ({ geomType, colors, layerOrder }) => {
  const infraID = useSelector(getInfraID);
  const { layersSettings } = useSelector((state: RootState) => state.map);

  const layerPoint = getDetectorsLayerProps({ colors, sourceTable: 'detectors' });
  const layerName = getDetectorsNameLayerProps({ colors, sourceTable: 'detectors' });

  return layersSettings.detectors ? (
    <Source
      id={`osrd_detectors_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/detectors/mvt/${geomType}/?infra=${infraID}`}
    >
      <OrderedLayer
        {...layerPoint}
        id={`chartis/osrd_detectors/${geomType}`}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...layerName}
        id={`chartis/osrd_detectors_name/${geomType}`}
        layerOrder={layerOrder}
      />
    </Source>
  ) : null;
};

export default Detectors;
