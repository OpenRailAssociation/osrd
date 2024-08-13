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

export type RangedValue = {
  begin: number;
  end: number;
  value: string;
};
