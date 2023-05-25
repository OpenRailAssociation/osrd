import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';
import { getInfraID } from 'reducers/osrdconf/selectors';
import colors from 'common/Map/Consts/colors';
import { getMapStyle } from 'reducers/map/selectors';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface DeadSectionsProps {
  geomType: string;
  layerOrder: number;
}

export default function DeadSections(props: DeadSectionsProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const mapStyle = useSelector(getMapStyle);
  const { geomType, layerOrder } = props;
  const deadSectionsParams: LayerProps = {
    type: 'line',
    'source-layer': 'dead_sections',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-join': 'miter',
    },
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'is_pantograph_drop_zone'], true],
        colors[mapStyle].dead_sections.drop_pantograph,
        colors[mapStyle].dead_sections.cut_off,
      ],
      'line-width': 6,
      'line-offset': 0,
      'line-opacity': .5,
      // 'line-dasharray': [3.0, 3.0],
    },
  };

  if (layersSettings.dead_sections) {
    return (
      <Source
        id={`dead_sections_${geomType}`}
        type="vector"
        url={`${MAP_URL}/layer/dead_sections/mvt/${geomType}/?infra=${infraID}`}
      >
        <OrderedLayer
          {...deadSectionsParams}
          id={`chartis/dead_sections/${geomType}`}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
