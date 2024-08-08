export const MANAGE_TRAIN_SCHEDULE_TYPES = Object.freeze({
  none: 'NONE',
  add: 'ADD',
  edit: 'EDIT',
  import: 'IMPORT',
});

export const STUDY_STATES = {
  started: 'started',
  inProgress: 'inProgress',
  finish: 'finish',
};

export type StudyState = keyof typeof STUDY_STATES;
export const studyStates = Object.keys(STUDY_STATES) as StudyState[];

export const STUDY_TYPES = [
  'nothingSelected',
  'timeTables',
  'flowRate',
  'parkSizing',
  'garageRequirement',
  'operationOrSizing',
  'operability',
  'strategicPlanning',
  'chartStability',
  'disturbanceTests',
] as const;

export type StudyType = typeof STUDY_TYPES;
