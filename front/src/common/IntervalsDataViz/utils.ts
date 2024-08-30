import type { CSSProperties } from 'react';

import { isNil, isNaN, omit, values } from 'lodash';

import type { LinearMetadataItem } from './types';

/**
 * Simple function that take an input and try to convert it as a number.
 */
export function castToNumber(value: unknown): number | null | undefined {
  if (isNil(value)) return value;

  if (typeof value === 'boolean') return +value;
  if (value === '') return null;

  const stringValue = `${value}`;
  const castValue = +stringValue;

  return isNaN(castValue) || Math.abs(castValue) === Infinity ? null : castValue;
}

/**
 * Given a number, shorten it in string.
 * Example 1234 -> 1.2K
 */
export function shortNumber(value: unknown): string {
  let num = castToNumber(value);
  if (isNil(num)) return '';

  if (Math.abs(num) < 1000) {
    return `${Math.round(num)}`;
  }

  const sign = num < 0 ? '-' : '';
  const suffixes: Record<string, number> = {
    K: 6,
    M: 9,
    B: 12,
    T: 16,
  };

  num = Math.abs(num);
  const size = Math.floor(num).toString().length;

  const exponent = size % 3 === 0 ? size - 3 : size - (size % 3);
  let shortNumberValue = `${Math.round(10 * (num / 10 ** exponent)) / 10}`;

  for (const suffix in suffixes) {
    if (exponent < suffixes[suffix]) {
      shortNumberValue += suffix;
      break;
    }
  }

  return sign + shortNumberValue;
}

/**
 * Round a number to the upper (or lower) number.
 */
export function roundNumber(value: number, upper = false): number {
  const round = Math.round(value);
  if (upper) return round < value ? round + 1 : round;
  return round > value ? round - 1 : round;
}

/**
 * Given a value, test if it is a round km value
 * Ex: 1km true, 1.3km false
 */
export function isRoundKm(value: number) {
  return value % 1000 === 0;
}

/**
 * Check if the object value are all null or undefined or not.
 *
 * @param obj The object to check
 * @param fields2omit A list of field to omit to check
 * @returns True if all fields are nil, false otherwise
 */
export function isNilObject(
  obj: { [key: string]: unknown },
  fields2omit: Array<string> = []
): boolean {
  return values(omit(obj, fields2omit)).every((e) => isNil(e));
}

/**
 * Function that check if value is not nil
 * with the good typesctipt type (usefull in filters on array)
 */
export function notEmpty<T>(value: T | null | undefined): value is T {
  return !isNil(value);
}

/**
 * Given a point (the provided coordinates), this function changes the position of the provided html element
 * so it's always on the user screen.
 * This funciton is really usefull when you want to display a tooltip near the mouse pointer.
 *
 * @param coordinates Usually the coordinate of the mouse
 * @param element The html element to move (ie. the div of the tooltip)
 */
export function tooltipPosition(coordinates: [number, number], element: HTMLElement): void {
  // constant
  const offset = 10;
  const maxX = window.innerWidth;
  const maxY = window.innerHeight;
  const mouseX = coordinates[0];
  const mouseY = coordinates[1];
  const elementWidth = element.offsetWidth;
  const elementHeight = element.offsetHeight;

  // compute diagonals
  const diagTopLeft = mouseX ** 2 + mouseY ** 2;
  const diagTopRight = (maxX - mouseX) ** 2 + mouseY ** 2;
  const diagBottomleft = mouseX ** 2 + (maxY - mouseY) ** 2;
  const diagBottomRight = (maxX - mouseX) ** 2 + (maxY - mouseY) ** 2;

  if (diagTopLeft > diagTopRight && diagTopLeft > diagBottomleft && diagTopLeft > diagBottomRight) {
    // display in top / Left
    element.style.top = `${mouseY - elementHeight - offset}px`;
    element.style.left = `${mouseX - elementWidth - offset}px`;
  } else if (
    diagTopRight > diagTopLeft &&
    diagTopRight > diagBottomleft &&
    diagTopRight > diagBottomRight
  ) {
    // display in top / right
    element.style.top = `${mouseY - elementHeight - offset}px`;
    element.style.left = `${mouseX + offset}px`;
  } else if (
    diagBottomleft > diagTopLeft &&
    diagBottomleft > diagTopLeft &&
    diagBottomleft > diagBottomRight
  ) {
    // display in bottom / left
    element.style.top = `${mouseY + offset}px`;
    element.style.left = `${mouseX - elementWidth - offset}px`;
  } else {
    // display in bottom / right;
    element.style.top = `${mouseY + offset}px`;
    element.style.left = `${mouseX + offset}px`;
  }
}

/**
 * Just the event preventdefault.
 * Usefull for listeners.
 */
export function preventDefault(e: Event): void {
  e.preventDefault();
}

/**
 * Function that compute the div style attribut for a data value.
 */
export function computeStyleForDataValue(
  value: unknown,
  min: number,
  max: number,
  fullHeightItem?: boolean
): CSSProperties {
  if (typeof value !== 'number' || fullHeightItem)
    return {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      height: `100%`,
      opacity: 0.8,
      zIndex: 2,
    };
  if (min < 0) {
    const negativeAreaHeightRatio = Math.abs(min / (max - min));
    const dataHeight = Math.abs(value / (max - min));
    return {
      height: `${dataHeight * 100}%`,
      bottom: `${
        (value >= 0 ? negativeAreaHeightRatio : negativeAreaHeightRatio - dataHeight) * 100
      }%`,
      position: 'relative',
      opacity: 0.8,
      zIndex: 2,
    };
  }
  return {
    height: `${((value - min) / (max - min)) * 100}%`,
    opacity: 0.8,
    zIndex: 2,
  };
}

/**
 * Get the linear metadata mouse position from a react event and the hovered segment.
 */
export function getPositionFromMouseEventAndSegment(
  event: React.MouseEvent<HTMLDivElement>,
  segment: LinearMetadataItem
): number {
  const target = event.target as HTMLDivElement;
  if (target.className.includes('resize')) return segment.end;
  const pxOffset = event.nativeEvent.offsetX;
  const pxSize = target.offsetWidth;
  return Math.round(segment.begin + (pxOffset / pxSize) * (segment.end - segment.begin));
}

/**
 * Get the linear metadata mouse position from a react event,
 * the full length of the intervals displayed and the wrapper
 *
 * @param event
 * @param fullLength
 * @param wrapper
 */
export function getPositionFromMouseEvent(
  event: React.MouseEvent<HTMLDivElement>,
  fullLength: number,
  wrapper: HTMLDivElement
): number {
  const pxOffset = event.clientX - wrapper.getBoundingClientRect().x;
  const wrapperWidth = wrapper.offsetWidth;
  return Math.round((pxOffset / wrapperWidth) * fullLength);
}
