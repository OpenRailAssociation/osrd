import { isNil } from 'lodash';
import { type LayerProps, Source, type SymbolLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import getKPLabelLayerProps from 'common/Map/Layers/KPLabel';
import getMastLayerProps from 'common/Map/Layers/mastLayerProps';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { LayerContext } from 'common/Map/Layers/types';
import { getMap } from 'reducers/map/selectors';
import type { Theme } from 'types';

export function getNeutralSectionSignsLayerProps({
  sourceTable,
  prefix,
}: Pick<LayerContext, 'sourceTable' | 'prefix'>): Omit<SymbolLayer, 'source'> {
  const res: Omit<SymbolLayer, 'source'> = {
    id: 'neutralSectionSignParams',
    type: 'symbol',
    minzoom: 11,
    paint: {},
    layout: {
      'icon-image': ['concat', prefix, ['get', 'type']],
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
      'icon-allow-overlap': true,
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
};

/**
 * Renders the layer for the neutral sections signs
 * https://osrd.fr/en/docs/explanation/models/neutral_sections
 */
export default function NeutralSectionSigns(props: NeutralSectionSignsProps) {
  const { colors, layerOrder, infraID } = props;
  const { mapStyle } = useSelector(getMap);
  const prefix = mapStyle === 'blueprint' ? 'SCHB ' : '';

  const signsParams: LayerProps = getNeutralSectionSignsLayerProps({
    sourceTable: 'neutral_signs',
    prefix,
  });
  const mastsParams: LayerProps = getMastLayerProps({
    sourceTable: 'neutral_signs',
  });

  const KPLabelsParams: LayerProps = getKPLabelLayerProps({
    colors,
    minzoom: 13,
    isSignalisation: true,
    sourceTable: 'neutral_signs',
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
