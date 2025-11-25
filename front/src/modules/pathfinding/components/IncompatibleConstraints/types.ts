import type {
  CoreIncompatibleConstraints as ApiIncompatibleConstraints,
  CoreIncompatibleOffsetRange,
  CoreIncompatibleOffsetRangeWithValue,
} from 'common/api/osrdEditoastApi';

export type IncompatibleConstraint =
  | CoreIncompatibleOffsetRange
  | CoreIncompatibleOffsetRangeWithValue;

export type IncompatibleConstraintType = keyof ApiIncompatibleConstraints;

export type IncompatibleConstraints = Record<IncompatibleConstraintType, IncompatibleConstraint[]>;

export type IncompatibleConstraintEnhanced = {
  id: string;
  type: IncompatibleConstraintType;
  start: number;
  end: number;
  value?: string;
  bbox: [number, number, number, number];
};

export type FiltersConstrainstState = Record<string, { count: number; enabled: boolean }>;
