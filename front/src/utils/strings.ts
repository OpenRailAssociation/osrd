import { round } from 'lodash';

import type { Unit } from './types';

export const NARROW_NO_BREAK_SPACE = '\u202f';
export const NO_BREAK_SPACE = '\xa0';

export function conditionalStringConcat<Condition>(
  elements: [Condition, string][],
  separator = ', '
) {
  function elementString([element, name]: [Condition, string]) {
    return element ? [name] : [];
  }
  return elements.reduce<string[]>((acc, el) => [...acc, ...elementString(el)], []).join(separator);
}

export function formatKmValue(value: number, unit: Unit = 'meters', digits = 3) {
  let divider = 1000;
  if (unit === 'millimeters') {
    divider = 1000000;
  }
  return `${(value / divider).toFixed(digits)}${NO_BREAK_SPACE}km`;
}

export function language2flag(lng: string) {
  switch (lng) {
    case 'en':
      return 'gb';
    case 'uk':
      return 'ua';
    default:
      return lng;
  }
}

export function snakeToCamel(str: string) {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase());
}

export function getTranslationKey(translationList: string | undefined, item: string): string {
  return `${translationList ? `${translationList}.` : ''}${item}`;
}

export function geti18nKeyForNull(str: string | null): string {
  return str || `N/C`;
}

/** Filter non digit characters */
export function onlyDigit(str: string): string {
  return str.replace(/[^0-9.]/g, '');
}

/**
 * Given a string, return a number or 0
 * Useful for number input
 */
export function convertInputStringToNumber(str: string) {
  return str !== '' && !Number.isNaN(str) ? +str : 0;
}

/**
 * Given an UIC number, check if it begins with 87,
 * if true return the UIC without the 87,
 * if false return the full UIC
 * @param uic full UIC and CI code (8 digits)
 */
export function formatUicToCi(uic: number) {
  return uic.toString().replace(/^87/, '');
}

/**
 * Given a distance in millimeters, returns a human readable string.
 * Exemples:
 * - 927520 -> 927m
 * - 1927520 -> 1.92Km
 *
 * @param distance the distance in millimeters
 * @returns A human readable string of the distance
 */
export function distanceToHumanReadable(distance: number): string {
  let label = `${distance}mm`;
  if (!distance) return '0';

  const meters = distance / 1000;
  if (Math.floor(meters) > 0) {
    label = `${round(meters, 0)}m`;
  }

  const kms = distance / 1000 / 1000;
  if (Math.floor(kms) > 0) {
    label = `${round(kms, 2)}Km`;
  }
  return label;
}
