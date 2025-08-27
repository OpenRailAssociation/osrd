import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type { CircleLayerSpecification, SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme, OmitLayer } from 'types';

import OrderedLayer from '../OrderedLayer';

export function getDetectorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
  highlightedArea?: Geometry;
}): OmitLayer<CircleLayerSpecification> {
  const res: OmitLayer<CircleLayerSpecification> = {
    type: 'circle',
    minzoom: 8,
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'circle-stroke-color': params.colors.detectors.circle,
      'circle-color': params.colors.detectors.circle,
      'circle-radius': 4,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getDetectorsNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
  highlightedArea?: Geometry;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 8,
    layout: {
      'text-field': '{extensions_sncf_kp}',
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.5, 0.2],
      visibility: 'visible',
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
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

type DetectorsProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

const Detectors = ({ colors, layerOrder, infraID, highlightedArea }: DetectorsProps) => {
  const layerPoint = getDetectorsLayerProps({ colors, sourceTable: 'detectors', highlightedArea });
  const layerName = getDetectorsNameLayerProps({
    colors,
    sourceTable: 'detectors',
    highlightedArea,
  });

  if (isNil(infraID)) return null;
  return (
    <Source
      id="osrd_detectors_geo"
      type="vector"
      url={`${MAP_URL}/layer/detectors/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...layerPoint} id="chartis/osrd_detectors/geo" layerOrder={layerOrder} />
      <OrderedLayer {...layerName} id="chartis/osrd_detectors_name/geo" layerOrder={layerOrder} />
    </Source>
  );
};

export default Detectors;
