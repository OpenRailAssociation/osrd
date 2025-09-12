import chroma from 'chroma-js';
import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type { CircleLayerSpecification, SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

import { DEFAULT_HALO_WIDTH, getAllowOverlap, getDynamicTextSize } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

export const DETECTOR_CIRCLES_DEF = [
  { radius: 6.5, stroke: 1, alpha: 0.5 },
  { radius: 3, stroke: 1.25, alpha: 0.75 },
  { radius: 0, stroke: 2, alpha: 1 },
];

export function getDetectorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
  highlightedArea?: Geometry;
  radius?: number;
  stroke?: number;
  alpha?: number;
}): OmitLayer<CircleLayerSpecification> {
  const res: OmitLayer<CircleLayerSpecification> = {
    type: 'circle',
    minzoom: 8,
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'circle-stroke-color': chroma(params.colors.detectors.circle)
        .alpha(params.alpha ?? 1)
        .css(),
      'circle-stroke-width': params.stroke ?? 2,
      'circle-color': chroma(params.colors.detectors.circleOther)
        .alpha(params.alpha ?? 1)
        .css(),
      'circle-radius': params.radius ?? 3,
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
      'text-font': ['IBMPlexSansCondensed-Medium'],
      'text-size': getDynamicTextSize(),
      'text-anchor': 'left',
      'text-allow-overlap': getAllowOverlap(),
      'text-offset': [0.75, 0],
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'text-color': params.colors.detectors.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': params.colors.detectors.halo,
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
  const layerPoint3 = getDetectorsLayerProps({
    colors,
    sourceTable: 'detectors',
    highlightedArea,
    ...DETECTOR_CIRCLES_DEF[0],
  });
  const layerPoint2 = getDetectorsLayerProps({
    colors,
    sourceTable: 'detectors',
    highlightedArea,
    ...DETECTOR_CIRCLES_DEF[1],
  });
  const layerPoint1 = getDetectorsLayerProps({
    colors,
    sourceTable: 'detectors',
    highlightedArea,
    ...DETECTOR_CIRCLES_DEF[2],
  });
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
      <OrderedLayer {...layerName} id="chartis/osrd_detectors_name/geo" layerOrder={layerOrder} />
      <OrderedLayer
        {...layerPoint3}
        id="chartis/osrd_detectors/geo-3"
        beforeId="chartis/osrd_detectors/geo-2"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...layerPoint2}
        id="chartis/osrd_detectors/geo-2"
        beforeId="chartis/osrd_detectors/geo-1"
        layerOrder={layerOrder}
      />
      <OrderedLayer {...layerPoint1} id="chartis/osrd_detectors/geo-1" layerOrder={layerOrder} />
    </Source>
  );
};

export default Detectors;
