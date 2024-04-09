import type { Position } from 'geojson';

export type SuggestedOP = {
  prId: string;
  name?: string;
  uic?: number;
  ch?: string;
  chLongLabel?: string;
  chShortLabel?: string;
  ci?: number;
  trigram?: string;
  offsetOnTrack: number;
  track: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath: number;
  coordinates: Position;
  /** Id of the path step which will be defined only when the OP is transformed into a via */
  stepId?: string;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: string | null;
  locked?: boolean;
  stopFor?: string | null;
};
