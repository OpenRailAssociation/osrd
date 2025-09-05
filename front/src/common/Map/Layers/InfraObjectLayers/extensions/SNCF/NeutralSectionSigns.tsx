import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { type LayerProps, Source, type SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import { getAllowOverlap } from 'common/Map/Layers/commonLayers';
import type { LayerContext } from 'common/Map/Layers/types';
import type { Theme } from 'common/Map/theme';

import OrderedLayer from '../../../OrderedLayer';
import getKPLabelLayerProps from '../../getKPLabelLayerProps';
import getMastLayerProps from '../../getMastLayerProps';

export function getNeutralSectionSignsLayerProps({
  sourceTable,
  highlightedArea,
}: Pick<LayerContext, 'sourceTable'> & { highlightedArea?: Geometry }): Omit<
  SymbolLayerSpecification,
  'source'
> {
  const res: Omit<SymbolLayerSpecification, 'source'> = {
    id: 'neutralSectionSignParams',
    type: 'symbol',
    minzoom: 11,
    paint: {},
    filter: highlightedArea ? ['within', highlightedArea] : true,
    layout: {
      'icon-image': ['get', 'type'],
      'icon-size': ['step', ['zoom'], 0.3, 13, 0.4],
      'icon-offset': [
        'step',
        ['zoom'],
        ['literal', [1.5, 0]],
        13,
        [
          'case',
          ['==', ['get', 'side'], 'RIGHT'],
          ['literal', [55, -80]],
          ['==', ['get', 'side'], 'LEFT'],
          ['literal', [-55, -80]],
          ['literal', [0, 0]],
        ],
      ],
      'icon-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'icon-allow-overlap': getAllowOverlap(),
      'icon-ignore-placement': false,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

type NeutralSectionSignsProps = {
  infraID: number | undefined;
  colors: Theme;
  layerOrder?: number;
  highlightedArea?: Geometry;
};

/**
 * Renders the layer for the neutral sections signs
 * https://osrd.fr/en/docs/explanation/models/neutral_sections
 */
export default function NeutralSectionSigns(props: NeutralSectionSignsProps) {
  const { colors, layerOrder, infraID, highlightedArea } = props;

  const signsParams: LayerProps = getNeutralSectionSignsLayerProps({
    sourceTable: 'neutral_signs',
  });
  const mastsParams: LayerProps = getMastLayerProps({
    sourceTable: 'neutral_signs',
    highlightedArea,
  });

  const KPLabelsParams: LayerProps = getKPLabelLayerProps({
    colors,
    minzoom: 13,
    isSignalisation: true,
    sourceTable: 'neutral_signs',
    highlightedArea,
  });

  if (isNil(infraID)) return null;
  return (
    <Source
      id="osrd_sncf_neutral_signs_geo"
      type="vector"
      url={`${MAP_URL}/layer/neutral_signs/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...mastsParams} layerOrder={layerOrder} />
      <OrderedLayer {...signsParams} layerOrder={layerOrder} />
      <OrderedLayer
        {...KPLabelsParams}
        id="chartis/osrd_neutral_signs_kp/geo"
        layerOrder={layerOrder}
      />
    </Source>
  );
}
