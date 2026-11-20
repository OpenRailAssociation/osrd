import type { Feature } from 'geojson';

export type Margin = {
  boundaries: string[];
  values: string[];
};

export type FeatureInfoClick = {
  feature: Feature;
  coordinates: number[];
  isOperationalPoint: boolean;
};
