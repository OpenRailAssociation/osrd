import type { PathItemLocation } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';

export type MarkerInformation = Pick<PathStep, 'id' | 'name' | 'coordinates' | 'metadata'> & {
  pointType: MARKER_TYPE;
  location: PathItemLocation;
};

export enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}
