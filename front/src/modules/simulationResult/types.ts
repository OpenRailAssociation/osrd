export type PositionScaleDomain = {
  initial: number[];
  current: number[];
  source?: 'SpeedSpaceChart' | 'SpaceCurvesSlopes';
};

export type TimeScaleDomain = {
  range?: [Date, Date];
  source?: 'SpaceTimeChart' | 'Timeline';
};
