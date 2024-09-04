import type { TrainScheduleBase, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { ArrayElement } from 'utils/types';

export type TimeExtraDays = {
  time: TimeString;
  daySinceDeparture?: number;
  dayDisplayed?: boolean;
};

export type PathWaypointRow = Omit<SuggestedOP, 'arrival' | 'departure'> & {
  isMarginValid: boolean;
  arrival?: TimeExtraDays; // value asked by user
  departure?: TimeExtraDays; // value asked by user
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
