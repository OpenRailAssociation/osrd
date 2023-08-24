import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, SymbolLayer, CircleLayer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';
import { RootState } from 'reducers';
import { Theme } from 'types';
import { getInfraID } from 'reducers/osrdconf/selectors';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

export function getSwitchesLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<CircleLayer, 'id'> {
  const res: Omit<CircleLayer, 'id'> = {
    type: 'circle',
    paint: {
      'circle-stroke-color': params.colors.switches.circle,
      'circle-stroke-width': 2,
      'circle-color': 'rgba(255, 255, 255, 0)',
      'circle-radius': 3,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getSwitchesNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    layout: {
      'text-field': '{label}',
      'text-font': ['Roboto Condensed'],
      'text-size': 12,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.1],
      visibility: 'visible',
    },
    paint: {
      'text-color': params.colors.switches.text,
      'text-halo-width': 2,
      'text-halo-color': params.colors.switches.halo,
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

interface SwitchesProps {
  geomType: string;
  colors: Theme;
  layerOrder: number;
}

const Switches: FC<SwitchesProps> = (props) => {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;

  const layerPoint = getSwitchesLayerProps({ colors, sourceTable: 'switches' });
  const layerName = getSwitchesNameLayerProps({ colors, sourceTable: 'switches' });

  return layersSettings.switches ? (
    <Source
      id={`osrd_switches_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/switches/mvt/${geomType}/?infra=${infraID}`}
    >
      <OrderedLayer
        {...layerPoint}
        id={`chartis/osrd_switches/${geomType}`}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...layerName}
        id={`chartis/osrd_switches_name/${geomType}`}
        layerOrder={layerOrder}
      />
    </Source>
  ) : null;
};

export default Switches;
