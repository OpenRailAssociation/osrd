/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const NARROW_NO_BREAK_SPACE = '\u202f';
export const NO_BREAK_SPACE = '\xa0';

export function conditionalStringConcat(elements: [any, string][], separator = ', ') {
  function elementString([element, name]: [any, string]) {
    return element ? [name] : [];
  }
  return elements.reduce<string[]>((acc, el) => [...acc, ...elementString(el)], []).join(separator);
}

export function formatKmValue(value?: number, digits = 0) {
  if (!value) {
    return '';
  }
  return `${value.toFixed(digits)}${NO_BREAK_SPACE}km`;
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
