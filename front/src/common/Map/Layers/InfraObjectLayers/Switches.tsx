import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type { SymbolLayerSpecification, CircleLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

import { DEFAULT_HALO_WIDTH, getAllowOverlap, getDynamicTextSize } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

export function getSwitchesLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
  highlightedArea?: Geometry;
}): OmitLayer<CircleLayerSpecification> {
  const res: OmitLayer<CircleLayerSpecification> = {
    type: 'circle',
    minzoom: 8,
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'circle-stroke-color': params.colors.switches.circle,
      'circle-stroke-width': 1,
      'circle-color': params.colors.switches.circleFill,
      'circle-radius': 3,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getSwitchesNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
  highlightedArea?: Geometry;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 8,
    layout: {
      'text-field': [
        'case',
        ['==', ['get', 'extensions_sncf_label'], 'N/A'],
        '',
        ['get', 'extensions_sncf_label'],
      ],
      'text-font': ['IBMPlexSansCondensed-Regular'],
      'text-size': getDynamicTextSize(),
      'text-anchor': 'left',
      'text-allow-overlap': getAllowOverlap(),
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.1],
      visibility: 'visible',
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'text-color': params.colors.switches.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': params.colors.switches.halo,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

type SwitchesProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

const Switches = ({ colors, layerOrder, infraID, highlightedArea }: SwitchesProps) => {
  const layerPoint = getSwitchesLayerProps({ colors, sourceTable: 'switches', highlightedArea });
  const layerName = getSwitchesNameLayerProps({ colors, sourceTable: 'switches', highlightedArea });

  if (isNil(infraID)) return null;
  return (
    <Source
      id="osrd_switches_geo"
      type="vector"
      url={`${MAP_URL}/layer/switches/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...layerPoint} id="chartis/osrd_switches/geo" layerOrder={layerOrder} />
      <OrderedLayer {...layerName} id="chartis/osrd_switches_name/geo" layerOrder={layerOrder} />
    </Source>
  );
};

export default Switches;
