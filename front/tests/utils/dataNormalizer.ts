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

// Trim and normalize whitespace in a string
export function cleanWhitespace(text: string = ''): string {
  return text.trim().replace(/\s+/g, ' ');
}

// Clean whitespace for an array of strings
export function cleanWhitespaceInArray(headers: string[]): string[] {
  return headers.map(cleanWhitespace);
}

// Normalize StationData by cleaning whitespace in all string fields
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
