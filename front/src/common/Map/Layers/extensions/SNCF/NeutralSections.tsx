import React from 'react';
import { useSelector } from 'react-redux';
import { type LayerProps, Source } from 'react-map-gl/maplibre';

import { type RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import NeutralSectionSigns from 'common/Map/Layers/extensions/SNCF/NeutralSectionSigns';
import type { Theme } from 'types';

type NeutralSectionsProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
};

export default ({ colors, layerOrder, infraID }: NeutralSectionsProps) => {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const neutralSectionsParams: LayerProps = {
    type: 'line',
    'source-layer': 'neutral_sections',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-join': 'miter',
    },
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'lower_pantograph'], true],
        colors.neutral_sections.lower_pantograph,
        colors.neutral_sections.switch_off,
      ],
      'line-width': 6,
      'line-offset': 0,
      'line-opacity': 0.5,
    },
  };

  if (layersSettings.neutral_sections) {
    return (
      <>
        <Source
          id="neutral_sections_geo"
          type="vector"
          url={`${MAP_URL}/layer/neutral_sections/mvt/geo/?infra=${infraID}`}
        >
          <OrderedLayer
            {...neutralSectionsParams}
            id="chartis/neutral_sections/geo"
            layerOrder={layerOrder}
          />
        </Source>
        <NeutralSectionSigns colors={colors} layerOrder={layerOrder} infraID={infraID} />
      </>
    );
  }
  return <div />;
};
