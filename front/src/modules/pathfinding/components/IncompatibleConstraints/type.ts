import type { Feature, LineString } from '@turf/helpers';

import type {
  IncompatibleElectrification,
  IncompatibleLoadingGauge,
  IncompatibleSignalingSystem,
  RangeOffet,
} from 'common/api/osrdEditoastApi';

export type IncompatibleConstraintItemType =
  | IncompatibleElectrification
  | IncompatibleLoadingGauge
  | IncompatibleSignalingSystem;

export type IncompatibleConstraintType = { [key: string]: IncompatibleConstraintItemType[] };

export type IncompatibleConstraintItemEnhanced = {
  id: string;
  range: RangeOffet;
  value?: string;
  type: string;
  geometry: Feature<LineString>;
  highlighted?: boolean;
};
