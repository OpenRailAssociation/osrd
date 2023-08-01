import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';
import { getInfraID } from 'reducers/osrdconf/selectors';
import colors from 'common/Map/Consts/colors';
import { getMapStyle } from 'reducers/map/selectors';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface NeutralSectionsProps {
  geomType: string;
  layerOrder: number;
}

export default function NeutralSections(props: NeutralSectionsProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const mapStyle = useSelector(getMapStyle);
  const { geomType, layerOrder } = props;
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
        colors[mapStyle].neutral_sections.lower_pantograph,
        colors[mapStyle].neutral_sections.cut_off,
      ],
      'line-width': 6,
      'line-offset': 0,
      'line-opacity': 0.5,
    },
  };

  if (layersSettings.neutral_sections) {
    return (
      <Source
        id={`neutral_sections_${geomType}`}
        type="vector"
        url={`${MAP_URL}/layer/neutral_sections/mvt/${geomType}/?infra=${infraID}`}
      >
        <OrderedLayer
          {...neutralSectionsParams}
          id={`chartis/neutral_sections/${geomType}`}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
