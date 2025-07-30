import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'react-map-gl/maplibre';

import { INFRA_ERRORS } from 'applications/editor/components/InfraErrors';
import type { OmitLayer } from 'types';

import { getDynamicTextSize } from './commonLayers';
import type { LayerContext } from './types';

const LINE_OBJECT = ['TrackSection', 'Electrification', 'SpeedSection'];
export function getLineErrorsLayerProps(context: LayerContext): OmitLayer<LineLayerSpecification> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<LineLayerSpecification> = {
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

export function getLineTextErrorsLayerProps(
  context: LayerContext
): OmitLayer<SymbolLayerSpecification> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    filter: [
      'all',
      ['in', ['get', 'obj_type'], ['literal', LINE_OBJECT]],
      ['in', ['get', 'error_type'], ['literal', enableErrorTypes]],
    ],
    layout: {
      'symbol-placement': 'line',
      'text-font': ['IBMPlexSansCondensed-Regular'],
      'text-size': getDynamicTextSize({ fromSize: 12, toSize: 18 }),
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

export function getPointErrorsLayerProps(
  context: LayerContext
): OmitLayer<CircleLayerSpecification> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<CircleLayerSpecification> = {
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

export function getPointTextErrorsLayerProps(
  context: LayerContext
): OmitLayer<SymbolLayerSpecification> {
  const enableErrorTypes = context.issuesSettings?.types || INFRA_ERRORS;
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    filter: [
      'all',
      ['!', ['in', ['get', 'obj_type'], ['literal', LINE_OBJECT]]],
      ['in', ['get', 'error_type'], ['literal', enableErrorTypes]],
    ],
    layout: {
      'symbol-placement': 'point',
      'text-font': ['IBMPlexSansCondensed-Regular'],
      'text-field': '{error_type}',
      'text-size': getDynamicTextSize({ fromSize: 12, toSize: 18 }),
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
