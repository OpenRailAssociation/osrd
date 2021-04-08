export const geoMainLayer = (colors) => ({
  id: 'geoMainLayer',
  type: 'line',
  paint: {
    'line-color': ['match', ['get', 'type_voie'],
      'VPL', colors.track.major,
      colors.track.major,
    ],
    'line-width': ['match', ['get', 'type_voie'],
      'VPL', 2,
      1,
    ],
  },
});

export const geoServiceLayer = (colors) => ({
  id: 'geoServiceLayer',
  type: 'line',
  filter: ['!=', 'type_voie', 'VP'],
  paint: {
    'line-color': colors.track.minor,
    'line-width': 1,
  },
});
