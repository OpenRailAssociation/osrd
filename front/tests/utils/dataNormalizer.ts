interface Margin {
  theoretical: string;
  theoreticalS: string;
  actual: string;
  difference: string;
}

export interface StationData {
  stationName: string;
  stationCh: string;
  requestedArrival: string;
  requestedDeparture: string;
  stopTime: string;
  signalReceptionClosed: boolean;
  shortSlipDistance: boolean;
  margin: Margin;
  calculatedArrival: string;
  calculatedDeparture: string;
}

/**
 * Trims leading/trailing whitespace and replaces multiple spaces with a single space.
 *
 * @param {string} [text=''] - The input string to clean.
 * @returns {string} - The cleaned string with normalized whitespace.
 */
export function cleanWhitespace(text: string = ''): string {
  return text.trim().replace(/\s+/g, ' '); // Replace multiple spaces with a single space
}

/**
 * Cleans whitespace for each string in an array of headers.
 *
 * @param {string[]} texts - The array of texts strings to clean.
 * @returns {string[]} - The cleaned array of texts.
 */
export function cleanWhitespaceInArray(texts: string[]): string[] {
  return texts.map(cleanWhitespace);
}

/**
 * Removes non-alphanumeric characters from a string.
 *
 * @param {string | null} text - The input text to clean.
 * @returns {string} - The cleaned text with non-alphanumeric characters removed.
 */
export function cleanText(text: string | null): string {
  return text?.replace(/[^A-Za-z0-9]/g, '') ?? '';
}

/**
 * Normalizes the StationData array by cleaning whitespace in all string fields.
 *
 * @param {StationData[]} data - The array of station data objects to normalize.
 * @returns {StationData[]} - The normalized array of station data with cleaned fields.
 */
export function normalizeData(data: StationData[]): StationData[] {
  return data.map((item) => ({
    stationName: cleanWhitespace(item.stationName),
    stationCh: cleanWhitespace(item.stationCh),
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
