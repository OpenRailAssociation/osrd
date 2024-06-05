import type { PowerRestrictionV2 } from 'applications/operationalStudies/consts';
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

export const createPowerRestrictions = (
  boundaries: number[],
  values: { type: string; voltage?: string }[]
): PowerRestrictionV2[] => {
  const powerRestrictions: PowerRestrictionV2[] = [];
  let currentVoltage = values[0]?.voltage || 'NO_POWER_RESTRICTION';

  // Add the first restriction from 0 to the first boundary
  powerRestrictions.push({
    from: '0',
    to: boundaries[0].toString(),
    value: currentVoltage,
  });

  for (let i = 0; i < boundaries.length - 1; i++) {
    if (values[i].type === 'electrification') {
      const nextVoltage = values[i].voltage || 'NO_POWER_RESTRICTION';

      // Check if the voltage changes
      if (nextVoltage !== currentVoltage) {
        currentVoltage = nextVoltage;
        powerRestrictions.push({
          from: boundaries[i].toString(),
          to: boundaries[i + 1].toString(),
          value: currentVoltage,
        });
      }
    }
  }
  console.log(powerRestrictions, 'powerRestrictions');
  return powerRestrictions;
};

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
