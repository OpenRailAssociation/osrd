import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import type {
  ColorSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from 'maplibre-gl';
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
  highlightedOperationalPoints?: number[];
};

function getColorByHighlighted(data: {
  highlightedArea?: Geometry;
  highlightedOperationalPoints?: number[];
  inColor: string | ExpressionSpecification;
  outColor: string | ExpressionSpecification;
}): DataDrivenPropertyValueSpecification<ColorSpecification> {
  if (data.highlightedOperationalPoints && data.highlightedOperationalPoints.length > 0)
    return [
      'case',
      ['in', ['get', 'extensions_sncf_ci'], ['literal', data.highlightedOperationalPoints]],
      data.inColor,
      data.outColor,
    ];
  if (data.highlightedArea)
    return ['case', ['within', data.highlightedArea], data.inColor, data.outColor];
  return data.inColor;
}

function getFilterHighlighted(
  data: {
    highlightedArea?: Geometry;
    highlightedOperationalPoints?: number[];
  },
  reverseCondition = false
): FilterSpecification {
  let result: FilterSpecification = true;
  if (data.highlightedOperationalPoints && data.highlightedOperationalPoints.length > 0)
    result = ['in', ['get', 'extensions_sncf_ci'], ['literal', data.highlightedOperationalPoints]];
  else if (data.highlightedArea) result = ['within', data.highlightedArea];

  if (reverseCondition === true) {
    return ['!=', result, true];
  }
  return result;
}

const OperationalPointsLayer = ({
  colors,
  layerOrder,
  infraID,
  operationnalPointId,
  highlightedArea,
  highlightedOperationalPoints,
}: OperationalPointsProps) => {
  if (isNil(infraID)) return null;

  const point: LayerProps = {
    type: 'circle',
    'source-layer': 'operational_points',
    minzoom: 8,
    paint: {
      'circle-stroke-color': colors.op.stroke,
      'circle-stroke-width': ['step', ['zoom'], 0.5, 16.5, 1.5],
      'circle-color': getColorByHighlighted({
        highlightedArea,
        highlightedOperationalPoints,
        inColor: [
          'case',
          ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
          colors.op.circleBV,
          colors.op.circle,
        ],
        outColor: colors.muted.color,
      }),
      'circle-radius': ['step', ['zoom'], 1.5, 16.5, 3],
    },
  };

  // There is a bug on the color, see https://github.com/maplibre/maplibre-gl-js/issues/5833
  const LABEL_SECTIONS: Array<{
    id: string;
    textFormat: [
      ExpressionSpecification,
      {
        'font-scale'?: number;
        'text-font'?: ExpressionSpecification;
        'text-color'?: string | ExpressionSpecification;
      },
    ];
  }> = [
    {
      id: 'pk',
      textFormat: [
        ['concat', ['get', 'kp'], '\n'],
        {
          'font-scale': 1,
          'text-color': colors.op.textTrigram,
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
          'text-color': colors.op.textTrigram,
        },
      ],
    },
    {
      id: 'name',
      textFormat: [
        ['concat', ['get', 'extensions_identifier_name'], '\n'],
        {
          'font-scale': 1.1,
          'text-color': colors.op.textName,
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
          'text-font': ['literal', ['IBMPlexSansCondensed-Medium']],
          'text-color': highlightedArea
            ? ['case', ['within', highlightedArea], colors.op.textYard, colors.muted.color]
            : colors.op.textYard,
        },
      ],
    },
  ];

  function getText(labelsToInclude?: string[], overrideTextColor?: string) {
    return LABEL_SECTIONS.filter((s) =>
      labelsToInclude ? labelsToInclude?.includes(s.id) : true
    ).flatMap((s) => {
      const textFormat = s.textFormat;
      if (overrideTextColor)
        return [textFormat[0], { ...textFormat[1], 'text-color': overrideTextColor }];
      else return textFormat;
    });
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
    filter: getFilterHighlighted({ highlightedArea, highlightedOperationalPoints }),
    paint: {
      'text-color': colors.op.textName,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': colors.op.halo,
    },
  };

  const nameMuted: LayerProps = {
    type: 'symbol',
    'source-layer': 'operational_points',
    minzoom: 7,
    layout: {
      'text-field': [
        'step',
        ['zoom'],
        ['format', ...getText(['pk', 'trigram', 'name', 'yard'], colors.muted.color)],
        7,
        ['format', ...getText(['trigram'], colors.muted.color)],
        9,
        ['format', ...getText(['pk', 'trigram'], colors.muted.color)],
        10,
        ['format', ...getText(['pk', 'trigram', 'name'], colors.muted.color)],
        17,
        ['format', ...getText(['pk', 'trigram', 'name', 'yard'], colors.muted.color)],
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
    filter: getFilterHighlighted({ highlightedArea, highlightedOperationalPoints }, true),
    paint: {
      'text-color': colors.muted.color,
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

      {highlightedOperationalPoints && highlightedOperationalPoints.length > 0 && (
        <OrderedLayer
          {...nameMuted}
          id="chartis/osrd_operational_point_name_muted/geo"
          layerOrder={layerOrder}
        />
      )}
    </Source>
  );
};

export default OperationalPointsLayer;
