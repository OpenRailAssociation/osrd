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

export function formatKmValue(value?: number, digits = 0) {
  if (!value) {
    return '';
  }
  return `${value.toFixed(digits)}${NO_BREAK_SPACE}km`;
}
