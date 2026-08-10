import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';

export enum INTERVAL_TYPES {
  NUMBER_WITH_UNIT = 'number-with-unit',
}

export type IntervalItem = LinearMetadataItem<{ value: number | string; unit?: string }>;
export type AdditionalDataItem = LinearMetadataItem<{ value: number | string }>;
