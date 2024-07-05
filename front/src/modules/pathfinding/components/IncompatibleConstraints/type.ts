import type {
  IncompatibleElectrification,
  IncompatibleLoadingGauge,
  IncompatibleSignalingSystem,
} from 'common/api/osrdEditoastApi';

export type IncompatibleConstraintItemType =
  | IncompatibleElectrification
  | IncompatibleLoadingGauge
  | IncompatibleSignalingSystem;

export type IncompatibleConstraintType = { [key: string]: IncompatibleConstraintItemType[] };

export type IncompatibleConstraintItemEnhanced = {
  id: string;
  type: string;
  start: number;
  end: number;
  value?: string;
  bbox: [number, number, number, number];
};
