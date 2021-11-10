export const schematicMainLayer = (colors) => ({
  id: 'schematicMainLayer',
  type: 'line',
  filter: ['==', 'type_voie', 'VP'],
  paint: {
    'line-color': ['match', ['get', 'TDV_mnemonique'],
      'VPL', colors.track.major,
      'VPA', colors.track.major,
      '#cd0037',
    ],
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
