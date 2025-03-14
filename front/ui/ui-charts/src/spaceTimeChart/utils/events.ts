import { type Point } from '../lib/types';

/**
 * This function takes a MouseEvent and an HTMLElement, and returns the position of the mouse,
 * relatively to the DOM element. This allows for instance dragging an element that is on the given
 * DOM element while the events are bound to the document or the body.
 */
export function getEventPosition(e: MouseEvent, dom: HTMLElement): Point {
  const bbox = dom.getBoundingClientRect();

  return {
    x: e.clientX - bbox.left,
    y: e.clientY - bbox.top,
  };
}

/**
 * This function returns a delta value for a given WheelEvent. It can be very useful, since the
 * given `deltaY` and `detail` attributes are not normalized.
 */
export function getEventWheelDelta(e: WheelEvent): number {
  if (typeof e.deltaY !== 'undefined') return (e.deltaY * -3) / 360;
  if (typeof e.detail !== 'undefined') return e.detail / -9;

  throw new Error('Could not extract delta from event.');
}
