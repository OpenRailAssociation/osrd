import type { PointOnMap } from 'applications/operationalStudies/consts';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';

export type PathfindingState = {
  running: boolean;
  done: boolean;
  error: string;
  missingParam: boolean;
  mustBeLaunched: boolean;
  mustBeLaunchedManually: boolean;
  cancelled: boolean;
};

export type PathfindingAction = {
  type: string;
  message?: string;
  params?: {
    origin?: Partial<PointOnMap>;
    destination?: Partial<PointOnMap>;
    rollingStockID?: number;
    vias?: Partial<PointOnMap>[];
    pathfindingId?: number;
  };
};

export type PathfindingActionV2 = {
  type: string;
  message?: string;
  params?: {
    origin: PathStep | null;
    destination: PathStep | null;
    rollingStock?: RollingStockWithLiveries;
  };
};
