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

// type Year = number;
// type Month = number;
// type Day = number;
// type Hour = number;
// type Minute = number;
// type Second = number;

export type TimeString = string | Date | undefined; // `${Year}-${Month}-${Day}T${Hour}:${Minute}:${Second}`;
