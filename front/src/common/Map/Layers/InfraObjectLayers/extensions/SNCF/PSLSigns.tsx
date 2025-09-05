import { isNil } from 'lodash';
import type { FilterSpecification } from 'maplibre-gl';
import type { LayerProps, SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { Source } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import { useInfraID } from 'common/osrdContext';

import OrderedLayer from '../../../OrderedLayer';
import type { LayerContext } from '../../../types';
import getKPLabelLayerProps from '../../getKPLabelLayerProps';
import getMastLayerProps from '../../getMastLayerProps';

type SNCF_PSL_SignsProps = {
  colors: Theme;
  layerOrder?: number;
  filter: FilterSpecification;
};

export function getPSLSignsLayerProps({
  sourceTable,
}: Pick<LayerContext, 'sourceTable'>): Omit<SymbolLayerSpecification, 'source'> {
  const res: Omit<SymbolLayerSpecification, 'source'> = {
    id: 'signParams',
    type: 'symbol',
    minzoom: 11,
    paint: {},
    layout: {
      'icon-image': [
        'case',
        ['==', ['get', 'type'], 'TIV_D'],
        ['concat', 'TIV D FIXE ', ['get', 'value']],
        ['==', ['get', 'type'], 'TIV_B'],
        ['concat', 'TIVD B FIX ', ['get', 'value']],
        ['get', 'type'],
      ],
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

export default function SNCF_PSL_Signs(props: SNCF_PSL_SignsProps) {
  const infraID = useInfraID();
  const { colors, layerOrder, filter } = props;

  const signsParams: LayerProps = getPSLSignsLayerProps({
    sourceTable: 'psl_signs',
  });

  const mastsParams: LayerProps = getMastLayerProps({
    sourceTable: 'psl_signs',
  });

  const KPLabelsParams: LayerProps = getKPLabelLayerProps({
    colors,
    minzoom: 13,
    isSignalisation: true,
    sourceTable: 'psl_signs',
  });

  if (isNil(infraID)) return null;
  return (
    <Source
      id="osrd_sncf_psl_signs_geo"
      type="vector"
      url={`${MAP_URL}/layer/psl_signs/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...mastsParams} layerOrder={layerOrder} filter={filter} />
      <OrderedLayer {...signsParams} layerOrder={layerOrder} filter={filter} />
      <OrderedLayer
        {...KPLabelsParams}
        id="chartis/osrd_psl_signs_kp/geo"
        layerOrder={layerOrder}
        filter={filter}
      />
    </Source>
  );
}
