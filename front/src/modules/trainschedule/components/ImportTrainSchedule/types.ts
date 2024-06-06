import type rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';

export interface Point {
  longitude: number;
  latitude: number;
  name: string;
  trackSectionId?: string;
}

export type RollingstockOpenData2OSRDKeys = keyof typeof rollingstockOpenData2OSRD;
