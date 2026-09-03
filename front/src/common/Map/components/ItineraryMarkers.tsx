import type { Position } from 'geojson';

import type { PathItemLocation } from 'common/api/osrdEditoastApi';

export type MarkerInformation = {
  id: string;
  name?: string;
  coordinates?: Position;
  metadata?: {
    lineCode: number;
    lineName: string;
    trackName: string;
    trackNumber: number;
  };
  pointType: MARKER_TYPE;
  location: PathItemLocation;
};

export enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}
