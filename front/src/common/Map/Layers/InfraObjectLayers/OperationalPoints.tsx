import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import type {
  ColorSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from 'maplibre-gl';
import { Source, type LayerProps } from 'react-map-gl/maplibre';

import { MAP_TRACK_SOURCE_LAYER, MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import { useMapContext } from 'common/Map/useMapContext';

import {
  DEFAULT_HALO_WIDTH,
  getDynamicTextSize,
  getAllowOverlap,
  trackNameLayer,
} from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

function getColorByHighlighted(data: {
  highlightedArea?: Geometry;
  highlightedOperationalPoints?: number[];
  inColor: string | ExpressionSpecification;
  outColor: string | ExpressionSpecification;
}): DataDrivenPropertyValueSpecification<ColorSpecification> {
  if (data.highlightedOperationalPoints && data.highlightedOperationalPoints.length > 0)
    return [
      'case',
      [
        'in',
        ['to-number', ['slice', ['to-string', ['get', 'uic']], 2]],
        ['literal', data.highlightedOperationalPoints],
      ],
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
    result = [
      'in',
      ['to-number', ['slice', ['to-string', ['get', 'uic']], 2]],
      ['literal', data.highlightedOperationalPoints],
    ];
  else if (data.highlightedArea) result = ['within', data.highlightedArea];

  if (reverseCondition === true) {
    return ['!=', result, true];
  }
  return result;
}

type OperationalPointsProps = {
  colors: Theme;
  layerOrder: number;
  operationnalPointId?: string;
  highlightedArea?: Geometry;
};

const OperationalPointsLayer = ({
  colors,
  layerOrder,
  operationnalPointId,
  highlightedArea,
}: OperationalPointsProps) => {
  const { infraId, highlightedOperationalPoints } = useMapContext();

  if (isNil(infraId)) return null;

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
          ['in', ['get', 'secondary_code'], ['literal', ['BV', '00']]],
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
          ['get', 'main_code'],
          ' ',
          [
            'case',
            ['in', ['get', 'secondary_code'], ['literal', ['BV', '00']]],
            '',
            ['get', 'secondary_code'],
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
        ['concat', ['get', 'name'], '\n'],
        {
          'font-scale': 1.1,
          'text-color': colors.op.textName,
        },
      ],
    },
    {
      id: 'local_track_name',
      textFormat: [
        ['concat', ['get', 'local_track_name'], '\n'],
        {
          'font-scale': 1,
          'text-color': colors.op.textName,
        },
      ],
    },
    {
      id: 'yard',
      textFormat: [
        [
          'case',
          ['in', ['get', 'secondary_code'], ['literal', ['BV', '00']]],
          '',
          ['concat', ' ', ['get', 'secondary_name']],
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
        ['format', ...getText(['pk', 'trigram', 'name', 'local_track_name'])],
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
    filter: getFilterHighlighted({
      highlightedArea,
      highlightedOperationalPoints,
    }),
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
      url={`${MAP_URL}/layer/operational_points/mvt/geo/?infra=${infraId}`}
    >
      <OrderedLayer {...point} id="chartis/osrd_operational_point/geo" layerOrder={layerOrder} />
      <OrderedLayer
        {...{
          ...trackNameLayer(colors, highlightedArea),
          layout: {
            ...trackNameLayer(colors, highlightedArea).layout,
            'text-field': '{local_track_name}',
          },
        }}
        id="chartis/tracks-geo/track-name"
        layerOrder={layerOrder}
        source-layer={MAP_TRACK_SOURCE_LAYER}
      />
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
