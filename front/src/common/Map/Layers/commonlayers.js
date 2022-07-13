export const trackNameLayer = (colors) => ({
  type: 'symbol',
  layout: {
    'text-font': [
      'Roboto Condensed',
    ],
    'symbol-placement': 'line',
    'text-size': 14,
    'text-allow-overlap': {
      stops: [[13.5, false], [14, true]],
    },
  },
  paint: {
    'text-color': colors.trackname.text,
    'text-halo-width': 2,
    'text-halo-color': colors.trackname.halo,
    'text-halo-blur': 1,
  },
});

export const lineNameLayer = (colors) => ({
  type: 'symbol',
  layout: {
    'text-font': [
      'Roboto Condensed',
    ],
    'symbol-placement': 'line-center',
    'text-field': '{line_name}',
    'text-size': 10,
    'text-offset': [0, 1],
  },
  paint: {
    'text-color': colors.linename.text,
    'text-halo-width': 2,
    'text-halo-color': colors.linename.halo,
    'text-halo-blur': 1,
  },
});

export const lineNumberLayer = (colors) => ({
  type: 'symbol',
  minzoom: 11,
  layout: {
    'text-font': [
      'Roboto Condensed',
    ],
    'symbol-placement': 'line',
    'text-size': 10,
    'text-offset': [0, 1],
  },
  paint: {
    'text-color': colors.line.text,
    'text-halo-width': 2,
    'text-halo-color': colors.line.halo,
    'text-halo-blur': 2,
  },
});

export const hoverLayer = () => ({
  type: 'line',
  paint: {
    'line-color': '#ffb612',
    'line-width': 3,
  },
});

export const hoverCircleLayer = () => ({
  type: 'circle',
  paint: {
    'circle-color': '#ffb612',
    'circle-radius': 5,
  },
});

export const selectedLayer = () => ({
  id: 'selectedLayer',
  type: 'line',
  paint: {
    'line-color': '#ffb612',
    'line-width': 3,
  },
});

export const selectedCircleLayer = () => ({
  id: 'selectedLayer',
  type: 'circle',
  paint: {
    'circle-color': '#ffb612',
    'circle-radius': 5,
  },
});
