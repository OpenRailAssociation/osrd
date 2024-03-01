import type { SymbolLayer, LineLayer, CircleLayer } from 'react-map-gl/maplibre';
import type { Theme, OmitLayer } from 'types';

export function trackNameLayer(colors: Theme): OmitLayer<SymbolLayer> {
  return {
    type: 'symbol',
    layout: {
      'text-font': ['Roboto Condensed'],
      'symbol-placement': 'line',
      'text-size': 12,
      // [jacomyal]
      // According to TS types, 'text-allow-overlap' should be a boolean or
      // nothing. But I don't dare yet to switch it.
      // eslint-disable-next-line
      // @ts-ignore
      'text-allow-overlap': {
        stops: [
          [13.5, false],
          [14, true],
        ],
      },
    },
    paint: {
      'text-color': colors.trackname.text,
      'text-halo-width': 2,
      'text-halo-color': colors.trackname.halo,
      'text-halo-blur': 1,
    },
  };
}

export function lineNameLayer(colors: Theme): OmitLayer<SymbolLayer> {
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

export function lineNumberLayer(colors: Theme): OmitLayer<SymbolLayer> {
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

export function hoverLayer(): OmitLayer<LineLayer> {
  return {
    type: 'line',
    paint: {
      'line-color': '#ffb612',
      'line-width': 3,
    },
  };
}

export function hoverCircleLayer(): OmitLayer<CircleLayer> {
  return {
    type: 'circle',
    paint: {
      'circle-color': '#ffb612',
      'circle-radius': 5,
    },
  };
}

export function selectedLayer(): Omit<LineLayer, 'source'> {
  return {
    id: 'selectedLayer',
    type: 'line',
    paint: {
      'line-color': '#ffb612',
      'line-width': 3,
    },
  };
}

export function selectedCircleLayer(): Omit<CircleLayer, 'source'> {
  return {
    id: 'selectedLayer',
    type: 'circle',
    paint: {
      'circle-color': '#ffb612',
      'circle-radius': 5,
    },
  };
}
