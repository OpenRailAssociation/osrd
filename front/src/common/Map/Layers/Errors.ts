import { CircleLayer, LineLayer, SymbolLayer } from 'react-map-gl';

import { Theme } from 'types';

export function getLineErrorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<LineLayer, 'id'> {
  const res: Omit<LineLayer, 'id'> = {
    type: 'line',
    filter: ['==', 'obj_type', 'TrackSection'],
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'is_warning'], 1],
        params.colors.warning.color,
        params.colors.error.color,
      ],
      'line-width': 2,
      'line-opacity': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getLineTextErrorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-offset': [0, -0.75],
      'text-field': '{error_type}',
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'is_warning'], 1],
        params.colors.warning.text,
        params.colors.error.text,
      ],
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getPointErrorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<CircleLayer, 'id'> {
  const res: Omit<CircleLayer, 'id'> = {
    type: 'circle',
    filter: ['!=', 'obj_type', 'TrackSection'],
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'is_warning'], 1],
        params.colors.warning.color,
        params.colors.error.color,
      ],
      'circle-radius': 2,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getPointTextErrorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    layout: {
      'symbol-placement': 'point',
      'text-font': ['Roboto Condensed'],
      'text-field': '{error_type}',
      'text-size': 10,
      'text-offset': [0, -0.75],
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'is_warning'], 1],
        params.colors.warning.text,
        params.colors.error.text,
      ],
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}
