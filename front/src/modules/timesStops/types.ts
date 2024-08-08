import type { TrainScheduleBase, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import type { ArrayElement } from 'utils/types';

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
