import { useState, useEffect } from 'react';
import 'moment/locale/fr';
import { ResourceType } from 'maplibre-gl';

/**
 * Debounce input fields
 */
export const useDebounce = <T = string | number>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

/**
 * Debounce function
 */
export const useDebouncedFunc = <T = (number | null) | (string | null)>(
  value: T,
  delay: number,
  func: (newValue: T) => void
) => {
  useEffect(() => {
    const handler = setTimeout(() => {
      func(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
};

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

/**
 * Add the authentication token to a request sent to fetch the map data (if needed)
 * @param url
 * @param resourceType - MapLibre resource type
 * @param mapUrl - url of the map
 * @returns the request with the authentication token if needed
 */
export function transformMapRequest(
  url: string,
  resourceType: ResourceType | undefined,
  mapUrl: string,
  spritesUrl: string
) {
  if (
    ((resourceType === 'Source' || resourceType === 'Tile') && url.startsWith(mapUrl)) ||
    ((resourceType === 'SpriteImage' || resourceType === 'SpriteJSON') &&
      url.startsWith(spritesUrl))
  ) {
    return {
      url,
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    };
  }
  return { url };
}
