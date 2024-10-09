import type { TrainScheduleBase, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { ArrayElement } from 'utils/types';

export type TimeExtraDays = {
  time: TimeString;
  daySinceDeparture?: number;
  dayDisplayed?: boolean;
};

export type TimeStopsRow = {
  opId: string;
  name?: string;
  ch?: string;
  isWaypoint: boolean;

  arrival?: TimeExtraDays; // value asked by user
  departure?: TimeExtraDays; // value asked by user
  stopFor?: string | null; // value asked by user
  onStopSignal?: boolean;
  shortSlipDistance?: boolean;
  theoreticalMargin?: string; // value asked by user

  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  calculatedArrival?: string | null;
  calculatedDeparture?: string | null;

  isMarginValid?: boolean;
};

export type TimesStopsInputRow = Omit<SuggestedOP, 'arrival' | 'departure'> & TimeStopsRow;

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
