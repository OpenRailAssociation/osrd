import { LayerProps } from 'react-map-gl/maplibre';
import { Theme } from 'types';

export function trackNameLayer(colors: Theme): LayerProps {
  return {
    type: 'symbol',
    layout: {
      'text-font': ['Roboto Condensed'],
      'symbol-placement': 'line',
      'text-size': 12,
      'text-allow-overlap': ['step', ['zoom'], 13.5, false, 14, true],
    },
    paint: {
      'text-color': colors.trackname.text,
      'text-halo-width': 2,
      'text-halo-color': colors.trackname.halo,
      'text-halo-blur': 1,
    },
  };
}

export function lineNameLayer(colors: Theme): LayerProps {
  return {
    type: 'symbol',
    layout: {
      'text-font': ['Roboto Condensed'],
      'symbol-placement': 'line-center',
      'text-field': '{line_name}',
      'text-size': 10,
      'text-offset': [0, 0.75],
    },
    paint: {
      'text-color': colors.linename.text,
      'text-halo-width': 2,
      'text-halo-color': colors.linename.halo,
      'text-halo-blur': 1,
    },
  };
}

export function lineNumberLayer(colors: Theme): LayerProps {
  return {
    type: 'symbol',
    minzoom: 11,
    layout: {
      'text-font': ['Roboto Condensed'],
      'symbol-placement': 'line',
      'text-size': 10,
      'text-offset': [0, 0.5],
    },
    paint: {
      'text-color': colors.line.text,
      'text-halo-width': 2,
      'text-halo-color': colors.line.halo,
      'text-halo-blur': 2,
    },
  };
}

export function hoverLayer(): LayerProps {
  return {
    type: 'line',
    paint: {
      'line-color': '#ffb612',
      'line-width': 3,
    },
  };
}

export function hoverCircleLayer(): LayerProps {
  return {
    type: 'circle',
    paint: {
      'circle-color': '#ffb612',
      'circle-radius': 5,
    },
  };
}

export function selectedLayer(): LayerProps {
  return {
    id: 'selectedLayer',
    type: 'line',
    paint: {
      'line-color': '#ffb612',
      'line-width': 3,
    },
  };
}

export function selectedCircleLayer(): LayerProps {
  return {
    id: 'selectedLayer',
    type: 'circle',
    paint: {
      'circle-color': '#ffb612',
      'circle-radius': 5,
    },
  };
}
