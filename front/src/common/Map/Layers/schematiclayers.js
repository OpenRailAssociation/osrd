export const schematicMainLayer = (colors) => ({
  id: 'schematicMainLayer',
  type: 'line',
  paint: {
    'line-color': colors.track.major,
    'line-width': ['match', ['get', 'TDV_mnemonique'],
      'VPL', 2,
      1,
    ],
  },
});

export const schematicServiceLayer = (colors) => ({
  id: 'schematicServiceLayer',
  type: 'line',
  filter: ['==', 'type_voie', 'VS'],
  paint: {
    'line-color': colors.track.minor,
    'line-width': 1,
  },
});
