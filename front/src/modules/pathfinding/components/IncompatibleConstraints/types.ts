import type {
  IncompatibleConstraints as ApiIncompatibleConstraints,
  IncompatibleOffsetRange,
  IncompatibleOffsetRangeWithValue,
} from 'common/api/osrdEditoastApi';

export type IncompatibleConstraint = IncompatibleOffsetRange | IncompatibleOffsetRangeWithValue;

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
