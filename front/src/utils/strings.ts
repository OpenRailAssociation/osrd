/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  return `${value.toFixed(digits)} km`;
}
