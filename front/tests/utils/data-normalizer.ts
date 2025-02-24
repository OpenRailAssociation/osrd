import type { StationData } from './types';

/**
 * Trim leading/trailing whitespace and replaces multiple spaces with a single space.
 *
 * @param text - The input string to clean.
 * @returns {string} - The cleaned string with normalized whitespace.
 */
export function cleanWhitespace(text: string = ''): string {
  return text.trim().replace(/\s+/g, ' '); // Replace multiple spaces with a single space
}

/**
 * Clean whitespace for each string in an array of headers.
 *
 * @param texts - The array of texts strings to clean.
 * @returns {string[]} - The cleaned array of texts.
 */
export function cleanWhitespaceInArray(texts: string[]): string[] {
  return texts.map(cleanWhitespace);
}

/**
 * Remove non-alphanumeric characters from a string.
 *
 * @param text - The input text to clean.
 * @returns {string} - The cleaned text with non-alphanumeric characters removed.
 */
export function cleanText(text: string | null): string {
  return text?.replace(/[^A-Za-z0-9]/g, '') ?? '';
}

/**
 * Normalize the StationData array by cleaning whitespace in all string fields.
 *
 * @param data - The array of station data objects to normalize.
 * @returns {StationData[]} - The normalized array of station data with cleaned fields.
 */
export function normalizeStationData(data: StationData[]): StationData[] {
  return data.map((item) => ({
    stationName: cleanWhitespace(item.stationName),
    stationCh: cleanWhitespace(item.stationCh),
    trackName: cleanWhitespace(item.trackName),
    requestedArrival: cleanWhitespace(item.requestedArrival),
    requestedDeparture: cleanWhitespace(item.requestedDeparture),
    stopTime: cleanWhitespace(item.stopTime),
    signalReceptionClosed: item.signalReceptionClosed,
    shortSlipDistance: item.shortSlipDistance !== undefined ? item.shortSlipDistance : false,
    margin: {
      theoretical: cleanWhitespace(item.margin.theoretical),
      theoreticalS: cleanWhitespace(item.margin.theoreticalS),
      actual: cleanWhitespace(item.margin.actual),
      difference: cleanWhitespace(item.margin.difference),
    },
    calculatedArrival: cleanWhitespace(item.calculatedArrival),
    calculatedDeparture: cleanWhitespace(item.calculatedDeparture),
  }));
}
