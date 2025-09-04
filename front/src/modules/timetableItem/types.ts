import type { Position } from 'geojson';

import type { ReceptionSignal } from 'common/api/osrdEditoastApi';
import type { Duration } from 'utils/duration';

export type SuggestedOP = {
  pathStepId?: string;
  opId?: string;
  name?: string;
  uic?: number;
  ch?: string;
  kp?: string;
  trigram?: string;
  offsetOnTrack: number;
  track: string;
  trackName?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath: number;
  coordinates?: Position;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: Duration | null; // value asked by user, number of seconds since departure
  locked?: boolean;
  stopFor?: Duration | null; // value asked by user
  theoreticalMargin?: string; // value asked by user
  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  calculatedArrival?: string | null;
  calculatedDeparture?: string | null;
  receptionSignal?: ReceptionSignal;
};
