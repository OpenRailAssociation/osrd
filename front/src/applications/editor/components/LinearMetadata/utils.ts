import { isNil, omit, values } from 'lodash';

/**
 * Round a number to the upper (or lower) number.
 */
export function roundNumber(value: number, upper = false): number {
  const round = Math.round(value);
  if (upper) return round < value ? round + 1 : round;
  else return round > value ? round - 1 : round;
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
  const diagTopLeft = Math.pow(mouseX, 2) + Math.pow(mouseY, 2);
  const diagTopRight = Math.pow(maxX - mouseX, 2) + Math.pow(mouseY, 2);
  const diagBottomleft = Math.pow(mouseX, 2) + Math.pow(maxY - mouseY, 2);
  const diagBottomRight = Math.pow(maxX - mouseX, 2) + Math.pow(maxY - mouseY, 2);

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
