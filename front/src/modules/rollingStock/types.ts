import type { Comfort, TrainCategory, TrainMainCategory } from 'common/api/osrdEditoastApi';

export type TransformedCurves = {
  [index: string]: {
    mode: string;
    comfort: Comfort;
    speeds: number[];
    max_efforts: number[];
    electricalProfile: string | null;
    powerRestriction: string | null;
  };
};

export type ParsedCurve = {
  color: string;
  comfort: Comfort;
  data: {
    x: number;
    y: number;
  }[];
  id: string;
  mode: string;
  electrical_profile_level?: string | null;
  power_restriction?: string | null;
};

export type MultiUnit =
  | 't'
  | 'kg'
  | 'km/h'
  | 'm/s'
  | 'N'
  | 'kN'
  | 'kN/t'
  | 'N/(m/s)'
  | 'N/(km/h)'
  | 'kN/(km/h)'
  | 'kN/(km/h)/t'
  | 'N/(m/s)²'
  | 'N/(km/h)²'
  | 'kN/(km/h)²'
  | 'kN/(km/h)²/t';

export type MultiUnitsParameter = {
  min: number;
  max: number;
  unit: MultiUnit;
  value: number;
};

export type CategoryOptionWithId = {
  id: string;
  label: string;
} & (
  | {
      category: TrainCategory | null;
    }
  | {
      category: TrainCategory;
      color: string;
      background_color: string;
      hovered_color: string;
      main_category: TrainMainCategory;
    }
);
