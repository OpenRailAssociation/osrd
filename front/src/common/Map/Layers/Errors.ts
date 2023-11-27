import { CircleLayer, LineLayer, SymbolLayer } from 'react-map-gl/maplibre';

import { INFRA_ERRORS } from 'applications/editor/components/InfraErrors';
import type { OmitLayer } from 'types';
import type { LayerContext } from './types';

const LINE_OBJECT = ['TrackSection', 'Electrification', 'SpeedSection'];
export function getLineErrorsLayerProps(context: LayerContext): OmitLayer<LineLayer> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<LineLayer> = {
    type: 'line',
    filter: [
      'all',
      ['in', ['get', 'obj_type'], ['literal', LINE_OBJECT]],
      ['in', ['get', 'error_type'], ['literal', enableErrorTypes]],
    ],
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'is_warning'], true],
        context.colors.warning.color,
        context.colors.error.color,
      ],
      'line-width': 2,
      'line-opacity': 1,
    },
  };

  if (typeof context.sourceTable === 'string') res['source-layer'] = context.sourceTable;
  return res;
}

export function getLineTextErrorsLayerProps(context: LayerContext): OmitLayer<SymbolLayer> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    filter: [
      'all',
      ['in', ['get', 'obj_type'], ['literal', LINE_OBJECT]],
      ['in', ['get', 'error_type'], ['literal', enableErrorTypes]],
    ],
    layout: {
      'symbol-placement': 'line',
      'text-font': ['Roboto Condensed'],
      'text-size': 12,
      'text-offset': [0, -0.75],
      'text-field': '{error_type}',
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'is_warning'], true],
        context.colors.warning.text,
        context.colors.error.text,
      ],
    },
  };

  if (typeof context.sourceTable === 'string') res['source-layer'] = context.sourceTable;
  return res;
}

export function getPointErrorsLayerProps(context: LayerContext): OmitLayer<CircleLayer> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<CircleLayer> = {
    type: 'circle',
    filter: [
      'all',
      ['!', ['in', ['get', 'obj_type'], ['literal', LINE_OBJECT]]],
      ['in', ['get', 'error_type'], ['literal', enableErrorTypes]],
    ],
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'is_warning'], true],
        context.colors.warning.color,
        context.colors.error.color,
      ],
      'circle-radius': 2,
    },
  };

  if (typeof context.sourceTable === 'string') res['source-layer'] = context.sourceTable;
  return res;
}

export function getPointTextErrorsLayerProps(context: LayerContext): OmitLayer<SymbolLayer> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    filter: [
      'all',
      ['!', ['in', ['get', 'obj_type'], ['literal', LINE_OBJECT]]],
      ['in', ['get', 'error_type'], ['literal', enableErrorTypes]],
    ],
    layout: {
      'symbol-placement': 'point',
      'text-font': ['Roboto Condensed'],
      'text-field': '{error_type}',
      'text-size': 12,
      'text-offset': [0, -0.75],
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'is_warning'], true],
        context.colors.warning.text,
        context.colors.error.text,
      ],
    },
  };

  if (typeof context.sourceTable === 'string') res['source-layer'] = context.sourceTable;
  return res;
}
