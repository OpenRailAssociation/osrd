import type { StdcmTranslations } from '../../utils/types';

export const allMissingFieldsKeys = [
  'tractionEngine',
  'totalMass',
  'totalLength',
  'maxSpeed',
  'origin',
  'destination',
] as const;

export const partialMissingFieldsKeys = [
  'tractionEngine',
  'totalMass',
  'totalLength',
  'maxSpeed',
] as const;

export type MissingFields = (typeof allMissingFieldsKeys)[number];

export const getFieldsLabel = (fields: readonly MissingFields[], translations: StdcmTranslations) =>
  fields.map((field) => translations.stdcmErrors.missingFields[field]);
