import { isNil } from 'lodash';
import { type LayerProps, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getLayersSettings } from 'reducers/map/selectors';
import type { Theme } from 'types';

import NeutralSectionSigns from './NeutralSectionSigns';

type NeutralSectionsProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  overrideStore?: boolean;
};

const NeutralSectionsLayer = ({
  colors,
  layerOrder,
  infraID,
  overrideStore = false,
}: NeutralSectionsProps) => {
  const layersSettings = useSelector(getLayersSettings);

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

  if ((!overrideStore && !layersSettings.neutral_sections) || isNil(infraID)) return null;
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
};

export default NeutralSectionsLayer;
