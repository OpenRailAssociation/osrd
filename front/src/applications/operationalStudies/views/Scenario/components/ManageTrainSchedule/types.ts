import type { Feature } from 'geojson';

import type { OperationalPointReference } from 'common/api/osrdEditoastApi';

export type Margin = {
  boundaries: string[];
  values: string[];
};

export type FeatureInfoClick = {
  feature: Feature;
  coordinates: number[];
  isOperationalPoint: boolean;
};

export type DomesticOperationalPointReference = Extract<
  OperationalPointReference,
  { type: 'domestic' }
>;
