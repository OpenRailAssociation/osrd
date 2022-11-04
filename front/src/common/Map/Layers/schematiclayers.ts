import { LayerProps } from 'react-map-gl';

import { Theme } from 'types';

export const schematicMainLayer = (colors: Theme): LayerProps => ({
  id: 'schematicMainLayer',
  type: 'line',
  paint: {
    'line-color': colors.track.major,
    'line-width': ['match', ['get', 'TDV_mnemonique'], 'VPL', 2, 1],
  },
});

export const schematicServiceLayer = (colors: Theme): LayerProps => ({
  id: 'schematicServiceLayer',
  type: 'line',
  filter: ['==', 'type_voie', 'VS'],
  paint: {
    'line-color': colors.track.minor,
    'line-width': 1,
  },
});
