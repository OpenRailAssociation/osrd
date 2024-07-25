import React from 'react';

import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type { SymbolLayer, CircleLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';
import type { Theme, OmitLayer } from 'types';

export function getTrackNodesLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): OmitLayer<CircleLayer> {
  const res: OmitLayer<CircleLayer> = {
    type: 'circle',
    minzoom: 8,
    paint: {
      'circle-stroke-color': params.colors.track_nodes.circle,
      'circle-stroke-width': 2,
      'circle-color': 'rgba(255, 255, 255, 0)',
      'circle-radius': 3,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getTrackNodesNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 8,
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
      'text-color': params.colors.track_nodes.text,
      'text-halo-width': 2,
      'text-halo-color': params.colors.track_nodes.halo,
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

interface TrackNodesProps {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
}

const TrackNodes = ({ colors, layerOrder, infraID }: TrackNodesProps) => {
  const { layersSettings } = useSelector((state: RootState) => state.map);

  const layerPoint = getTrackNodesLayerProps({ colors, sourceTable: 'track_nodes' });
  const layerName = getTrackNodesNameLayerProps({ colors, sourceTable: 'track_nodes' });

  if (!layersSettings.track_nodes || isNil(infraID)) return null;
  return (
    <Source
      id="osrd_track_nodes_geo"
      type="vector"
      url={`${MAP_URL}/layer/track_nodes/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...layerPoint} id="chartis/osrd_track_nodes/geo" layerOrder={layerOrder} />
      <OrderedLayer {...layerName} id="chartis/osrd_track_nodes_name/geo" layerOrder={layerOrder} />
    </Source>
  );
};

export default TrackNodes;
