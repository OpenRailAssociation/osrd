import type { TrainScheduleBase, TrainScheduleResult } from 'common/api/generatedEditoastApi';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { ArrayElement } from 'utils/types';

export type PathWaypointRow = SuggestedOP & {
  isMarginValid: boolean;
};

export enum TableType {
  Input = 'Input',
  Output = 'Output',
}

export type PathStepOpPointCorrespondance = { correspondingOpPointIndex: number };

type TrainSchedulePathStep = ArrayElement<TrainScheduleBase['path']>;
export type TrainScheduleBasePathWithUic = Extract<TrainSchedulePathStep, { uic: number }>;

export type ScheduleEntry = ArrayElement<TrainScheduleResult['schedule']>;

export type ComputedScheduleEntry = {
  arrival: number | null;
  departure: number | null;
  stopFor: number | null;
};
