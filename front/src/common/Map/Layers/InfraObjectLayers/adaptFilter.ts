import { omit } from 'lodash';
import type { FilterSpecification } from 'maplibre-gl';

import type { LayerProps } from '../types';

const ERROR_LAYERS_ID_SUFFIX = [
  'geo/errors-line',
  'geo/errors-line-label',
  'geo/errors-point',
  'geo/errors-point-label',
];

/**
 * Helper to check if some MapLibre filter is not a valid
 * ExpressionFilterSpecification (in which case it is a
 * LegacyFilterSpecification):
 */
const LEGACY_ONLY_SIMPLE_OPERATORS = new Set([
  '!has',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  '!in',
  // The 'has' operator is also a valid ExpressionFilterSpecification operator,
  // so it is not a LEGACY_ONLY_SIMPLE_OPERATORS.
  // 'has',
]);
const LEGACY_ONLY_NESTED_OPERATORS = new Set(['all', 'any', 'none']);
const LEGACY_ONLY_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
function isLegacyOnlyFilter(filter: FilterSpecification | null): boolean {
  if (!filter) return false;

  if (typeof filter === 'boolean') return false;

  if (Array.isArray(filter)) {
    const [operator, firstArg, ...args] = filter;
    if (LEGACY_ONLY_NESTED_OPERATORS.has(operator))
      return args.every((value) => isLegacyOnlyFilter(value as FilterSpecification));
    if (LEGACY_ONLY_SIMPLE_OPERATORS.has(operator))
      return (
        typeof firstArg === 'string' &&
        args.every((value) => LEGACY_ONLY_VALUE_TYPES.has(typeof value))
      );
  }

  return false;
}

/**
 * Helper to add filters to existing LayerProps.filter values.
 * @param layer
 * @param idsToHide An array of entity IDs to hide
 * @param onlyIdsToShow An array of only entity IDs to show (only considered
 *                      when not empty)
 * @param removeZoomContraint If true, the existing 'minzoom' filters from the
 *                            input layer props are removed from the output
 *                            result
 */
export function adaptFilter(
  layer: LayerProps,
  idsToHide: string[],
  onlyIdsToShow: string[],
  removeZoomContraint?: boolean
): LayerProps {
  if (layer.type === 'background') return layer;

  const updatedLayer: LayerProps = removeZoomContraint
    ? (omit(layer, 'minzoom') as LayerProps)
    : { ...layer };
  const conditions: FilterSpecification[] = layer.filter ? [layer.filter] : [];

  // MapLibre does not allow combining in a logical tree expression filters and legacy filters.
  // We have to check that the existing filters do not contain expression filters:
  const hasExpressionFilters = !isLegacyOnlyFilter(layer.filter ?? null);

  // Get the field name of the id field. Default is 'id', but for example on error layers its obj_id
  let fieldId = 'id';
  if (layer.id && ERROR_LAYERS_ID_SUFFIX.some((suffix) => layer.id?.endsWith(suffix)))
    fieldId = 'obj_id';
  if (hasExpressionFilters) {
    // Add the conditions as ExpressionFilterSpecification:
    if (onlyIdsToShow.length) conditions.push(['in', ['get', fieldId], ['literal', onlyIdsToShow]]);
    if (idsToHide.length) conditions.push(['!', ['in', ['get', fieldId], ['literal', idsToHide]]]);
  } else {
    // For various reasons (detailed in #5850), we should stop using
    // LegacyFilterSpecification. So, in case there are some, it logs a warning
    // so that we can clean it later:
    console.warn(
      `The filter "${
        layer.id || JSON.stringify(layer)
      }" is a LegacyFilterSpecification. It should be an ExpressionFilterSpecification instead.`,
      layer.filter
    );

    // Add the conditions as LegacyFilterSpecification:
    if (onlyIdsToShow.length) conditions.push(['in', fieldId, ...onlyIdsToShow]);
    if (idsToHide.length) conditions.push(['!in', fieldId, ...idsToHide]);
  }

  switch (conditions.length) {
    case 0:
      return updatedLayer;
    case 1:
      return { ...updatedLayer, filter: conditions[0] } as LayerProps;
    default:
      // for 'all' predicate, 'conditions' must be a 'LegacyFilterSpecification' type
      // that why we use the 'as'
      return { ...updatedLayer, filter: ['all', ...conditions] } as LayerProps;
  }
}
