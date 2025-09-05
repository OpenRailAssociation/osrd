import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import type { ExpressionSpecification } from 'maplibre-gl';
import { Source, type LayerProps } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';

import { DEFAULT_HALO_WIDTH, getDynamicTextSize, getAllowOverlap } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

type OperationalPointsProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  operationnalPointId?: string;
  highlightedArea?: Geometry;
};

const OperationalPointsLayer = ({
  colors,
  layerOrder,
  infraID,
  operationnalPointId,
  highlightedArea,
}: OperationalPointsProps) => {
  if (isNil(infraID)) return null;

  const point: LayerProps = {
    type: 'circle',
    'source-layer': 'operational_points',
    minzoom: 8,
    paint: {
      'circle-stroke-color': colors.op.stroke,
      'circle-stroke-width': 1.5,
      'circle-color': highlightedArea
        ? [
            'case',
            ['within', highlightedArea],
            [
              'case',
              ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
              colors.op.circleBV,
              colors.op.circle,
            ],
            colors.muted.color,
          ]
        : [
            'case',
            ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
            colors.op.circleBV,
            colors.op.circle,
          ],
      'circle-radius': 3,
    },
  };

  // There is a bug on the color, see https://github.com/maplibre/maplibre-gl-js/issues/5833
  const LABEL_SECTIONS: Array<{
    id: string;
    textFormat: Array<
      | ExpressionSpecification
      | {
          'font-scale'?: number;
          'text-color'?: string | ExpressionSpecification;
          'text-font'?: ExpressionSpecification;
        }
    >;
  }> = [
    {
      id: 'pk',
      textFormat: [
        ['concat', ['get', 'kp'], '\n'],
        {
          'font-scale': 1,
          'text-color': highlightedArea
            ? ['case', ['within', highlightedArea], colors.op.textTrigram, colors.muted.color]
            : colors.op.textTrigram,
        },
      ],
    },
    {
      id: 'trigram',
      textFormat: [
        [
          'concat',
          ['get', 'extensions_sncf_trigram'],
          ' ',
          [
            'case',
            ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
            '',
            ['get', 'extensions_sncf_ch'],
          ],
          '\n',
        ],
        {
          'font-scale': 1.1,
          'text-color': highlightedArea
            ? ['case', ['within', highlightedArea], colors.op.textTrigram, colors.muted.color]
            : colors.op.textTrigram,
        },
      ],
    },
    {
      id: 'name',
      textFormat: [
        ['concat', ['get', 'extensions_identifier_name'], '\n'],
        {
          'font-scale': 1.1,
          'text-color': highlightedArea
            ? ['case', ['within', highlightedArea], colors.op.textName, colors.muted.color]
            : colors.op.textName,
        },
      ],
    },
    {
      id: 'yard',
      textFormat: [
        [
          'case',
          ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
          '',
          ['concat', ' ', ['get', 'extensions_sncf_ch_long_label']],
        ],
        {
          'font-scale': 1,
          'text-color': highlightedArea
            ? ['case', ['within', highlightedArea], colors.op.textYard, colors.muted.color]
            : colors.op.textYard,
          'text-font': ['literal', ['IBMPlexSansCondensed-Medium']],
        },
      ],
    },
  ];

  function getText(filter?: string[]) {
    return LABEL_SECTIONS.filter((s) => (filter ? filter?.includes(s.id) : true)).flatMap(
      (s) => s.textFormat
    );
  }

  const name: LayerProps = {
    type: 'symbol',
    'source-layer': 'operational_points',
    minzoom: 7,
    layout: {
      'text-field': [
        'step',
        ['zoom'],
        ['format', ...getText()],
        7,
        ['format', ...getText(['trigram'])],
        9,
        ['format', ...getText(['pk', 'trigram'])],
        10,
        ['format', ...getText(['pk', 'trigram', 'name'])],
        17,
        ['format', ...getText()],
      ],
      'text-font': [
        'case',
        ['==', ['get', 'id'], operationnalPointId || ''],
        ['literal', ['IBMPlexSans']],
        ['literal', ['IBMPlexSansCondensed-Medium']],
      ],
      'text-letter-spacing': 0.05,
      'text-size': getDynamicTextSize(),
      'text-anchor': 'top-left',
      'text-allow-overlap': getAllowOverlap(),
      'text-justify': 'left',
      'text-offset': [0.75, -1],
      'text-max-width': 32,
    },
    paint: {
      'text-color': highlightedArea
        ? ['case', ['within', highlightedArea], colors.op.textName, colors.muted.color]
        : colors.op.textName,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': colors.op.halo,
    },
  };

  return (
    <Source
      id="osrd_operational_point_geo"
      type="vector"
      url={`${MAP_URL}/layer/operational_points/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...point} id="chartis/osrd_operational_point/geo" layerOrder={layerOrder} />
      <OrderedLayer
        {...name}
        id="chartis/osrd_operational_point_name/geo"
        layerOrder={layerOrder}
      />
    </Source>
  );
};

export default OperationalPointsLayer;
