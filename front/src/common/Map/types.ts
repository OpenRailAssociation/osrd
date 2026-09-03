import type { Position } from 'geojson';

import type { PathItemLocation } from 'common/api/osrdEditoastApi';

export type MarkerInformation = {
  key: string;
  name: string;
  coordinates: Position;
  pointType: MARKER_TYPE;
  location: PathItemLocation;
  isBackTrack?: boolean;
};

export enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}
