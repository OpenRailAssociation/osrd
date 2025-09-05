import type { Geometry } from 'geojson';
import type { PropertyValueSpecification } from 'maplibre-gl';
import type {
  SymbolLayerSpecification,
  LineLayerSpecification,
  CircleLayerSpecification,
} from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

// Default symbol spacing (see https://maplibre.org/maplibre-style-spec/layers/#symbol-spacing)
export const DEFAULT_SYMBOL_SPACING: PropertyValueSpecification<number> = 500;

export const DEFAULT_HALO_WIDTH = 3;

/**
 * Generate the text-allow-overlap/icon-allow-overlap that avoid collision till a level, on which we display everything
 */
export function getAllowOverlap(falseAtZoomLevel = 20.5): PropertyValueSpecification<boolean> {
  return ['step', ['zoom'], false, falseAtZoomLevel, true];
}

/**
 * Generate the text-size for having a dynamic size which grows with the zoom level.
 */
export function getDynamicTextSize(opts?: {
  fromZoom?: number;
  fromSize?: number;
  toZoom?: number;
  toSize?: number;
}): PropertyValueSpecification<number> {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    opts?.fromZoom || 15,
    opts?.fromSize || 10,
    opts?.toZoom || 22,
    opts?.toSize || 16,
  ];
}

export function trackNameLayer(
  colors: Theme,
  highlightedArea: Geometry | undefined = undefined
): OmitLayer<SymbolLayerSpecification> {
  return {
    type: 'symbol',
    minzoom: 17,
    layout: {
      'text-font': ['IBMPlexSansCondensed-Medium'],
      'symbol-placement': 'line',
      'text-allow-overlap': true,
      'text-offset': [0, 0],
      'text-rotation-alignment': 'viewport',
      'text-size': getDynamicTextSize({ fromSize: 11 }),
      'symbol-spacing': DEFAULT_SYMBOL_SPACING,
    },
    paint: {
      'text-color': highlightedArea
        ? ['case', ['within', highlightedArea], colors.trackname.text, colors.muted.color]
        : colors.trackname.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': highlightedArea
        ? ['case', ['within', highlightedArea], colors.trackname.halo, colors.muted.color]
        : colors.trackname.halo,
    },
  };
}

export function lineNameLayer(
  colors: Theme,
  highlightedArea: Geometry | undefined = undefined
): OmitLayer<SymbolLayerSpecification> {
  return {
    type: 'symbol',
    layout: {
      'text-field': '{line_name}',
      'text-font': ['IBMPlexSansCondensed-Medium'],
      'text-offset': [10, 1],
      'text-allow-overlap': getAllowOverlap(),
      'text-size': getDynamicTextSize(),
      'symbol-placement': 'line',
      'symbol-spacing': DEFAULT_SYMBOL_SPACING,
    },
    paint: {
      'text-color': highlightedArea
        ? ['case', ['within', highlightedArea], colors.linename.text, colors.muted.color]
        : colors.linename.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': colors.linename.halo,
    },
  };
}

export function lineNumberLayer(
  colors: Theme,
  highlightedArea: Geometry | undefined = undefined
): OmitLayer<SymbolLayerSpecification> {
  return {
    type: 'symbol',
    minzoom: 11,
    layout: {
      'text-font': ['IBMPlexSans'],
      'text-offset': [-10, -1],
      'text-allow-overlap': getAllowOverlap(),
      'text-size': getDynamicTextSize(),
      'symbol-placement': 'line',
      'symbol-spacing': DEFAULT_SYMBOL_SPACING,
    },
    paint: {
      'text-color': highlightedArea
        ? ['case', ['within', highlightedArea], colors.line.text, colors.muted.color]
        : colors.line.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': colors.line.halo,
    },
  };
}

export function hoverLayer(): OmitLayer<LineLayerSpecification> {
  return {
    type: 'line',
    paint: {
      'line-color': '#ffb612',
      'line-width': 3,
    },
  };
}

export function hoverCircleLayer(): OmitLayer<CircleLayerSpecification> {
  return {
    type: 'circle',
    paint: {
      'circle-color': '#ffb612',
      'circle-radius': 5,
    },
  };
}

export function selectedLayer(): Omit<LineLayerSpecification, 'source'> {
  return {
    id: 'selectedLayer',
    type: 'line',
    paint: {
      'line-color': '#ffb612',
      'line-width': 3,
    },
  };
}

export function selectedCircleLayer(): Omit<CircleLayerSpecification, 'source'> {
  return {
    id: 'selectedLayer',
    type: 'circle',
    paint: {
      'circle-color': '#ffb612',
      'circle-radius': 5,
    },
  };
}
