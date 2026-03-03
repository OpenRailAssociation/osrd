/**
 * Given a boolean isHovering, returns the pointer class string
 */
export function getCursorClass(isHovering: boolean): 'pointer' | 'default' {
  return isHovering ? 'pointer' : 'default';
}

/**
 * Given a boolean isVisible, returns the corresponding class string
 */
export function getVisibilityClass(isVisible: boolean): 'visible' | 'none' {
  return isVisible ? 'visible' : 'none';
}

/**
 * Round the given value to the 10 000th
 */
export function gpsRound(val: number) {
  return Math.round(val * 10000) / 10000;
}
