// eslint-disable-next-line import/prefer-default-export
export const DATA_TYPES = {
  string: 'STRING',
  date: 'DATE',
  array: 'ARRAY',
  status: 'STATUS',
  action: 'ACTION',
  object: 'OBJECT',
  number: 'NUMBER',
  percent: 'PERCENT',
};

/**
 * A string with the format HH:MM:SS or HH:MM
 */
export type TimeString = string;

/**
 * A string with the complete iso format
 *
 * @example "2024-08-08T10:12:46.209Z"
 * @example "2024-08-08T10:12:46Z"
 * @example "2024-08-08T10:12:46+02:00"
 */
export type IsoDateTimeString = string;

/**
 * A ISO 8601 duration string
 * @example "PT3600S"
 */
export type IsoDurationString = string;

export type RangedValue = {
  begin: number;
  end: number;
  value: string;
};
