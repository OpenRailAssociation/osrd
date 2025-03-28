import type { StdcmTranslations } from '../../utils/types';

export const ALL_MISSING_FIELDS_KEY = [
  'tractionEngine',
  'totalMass',
  'totalLength',
  'maxSpeed',
  'origin',
  'destination',
] as const;

export const PARTIAL_MISSING_FIELDS_KEYS = [
  'tractionEngine',
  'totalMass',
  'totalLength',
  'maxSpeed',
] as const;

export const REMOVED_MISSING_FIELDS_KEYS = ['origin', 'destination'] as const;

export type MissingFields = (typeof ALL_MISSING_FIELDS_KEY)[number];

export const getFieldsLabel = (fields: readonly MissingFields[], translations: StdcmTranslations) =>
  fields.map((field) => translations.stdcmErrors.missingFields[field]);

export const ALL_INVALID_FIELDS_KEY = ['totalMass', 'totalLength', 'maxSpeed'] as const;

export type InvalidFields = (typeof ALL_INVALID_FIELDS_KEY)[number];
