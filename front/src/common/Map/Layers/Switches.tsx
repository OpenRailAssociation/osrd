import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, SymbolLayer, CircleLayer } from 'react-map-gl/maplibre';
import { MAP_URL } from 'common/Map/const';
import { RootState } from 'reducers';
import { Theme, OmitLayer } from 'types';
import { getInfraID } from 'reducers/osrdconf/selectors';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

export function getSwitchesLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): OmitLayer<CircleLayer> {
  const res: OmitLayer<CircleLayer> = {
    type: 'circle',
    minzoom: 8,
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
  editor?: boolean;
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 8,
    layout: {
      'text-field': !params.editor
        ? '{extensions_sncf_label}'
        : [
            'format',
            ['get', 'id'],
            { 'font-scale': 1 },
            '\n',
            {},
            ['get', 'extensions_sncf_label'],
            { 'font-scale': 0.8 },
          ],
      'text-font': ['Roboto Condensed'],
      'text-justify': 'left',
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
  colors: Theme;
  layerOrder: number;
}

const Switches: FC<SwitchesProps> = (props) => {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { colors, layerOrder } = props;

  const layerPoint = getSwitchesLayerProps({ colors, sourceTable: 'switches' });
  const layerName = getSwitchesNameLayerProps({ colors, sourceTable: 'switches' });

  return layersSettings.switches ? (
    <Source
      id="osrd_switches_geo"
      type="vector"
      url={`${MAP_URL}/layer/switches/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...layerPoint} id="chartis/osrd_switches/geo" layerOrder={layerOrder} />
      <OrderedLayer {...layerName} id="chartis/osrd_switches_name/geo" layerOrder={layerOrder} />
    </Source>
  ) : null;
};

export default Switches;
