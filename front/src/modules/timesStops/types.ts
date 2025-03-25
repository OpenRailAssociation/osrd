import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { ArrayElement } from 'utils/types';

export type TimeExtraDays = {
  time: TimeString;
  daySinceDeparture?: number;
  dayDisplayed?: boolean;
};

export type TimesStopsRow = {
  pathStepId?: string;
  opId?: string;
  name?: string;
  ch?: string;
  trackName?: string;

  arrival?: TimeExtraDays; // value asked by user
  departure?: TimeExtraDays; // value asked by user
  stopFor?: string | null; // value asked by user
  onStopSignal?: boolean;
  shortSlipDistance?: boolean;
  theoreticalMargin?: string; // value asked by user
  isTheoreticalMarginBoundary?: boolean; // tells whether the theoreticalMargin value was inputted for this line or if it is repeated from a previous line

  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  calculatedArrival?: string | null;
  calculatedDeparture?: string | null;

  isMarginValid?: boolean;
};

export type TimesStopsInputRow = Omit<SuggestedOP, 'arrival' | 'departure' | 'stopFor'> &
  TimesStopsRow;

export enum TableType {
  Input = 'Input',
  Output = 'Output',
}

export type ScheduleEntry = ArrayElement<TrainScheduleBase['schedule']>;

export type TheoreticalMarginsRecord = Record<
  string,
  { theoreticalMargin: string; isBoundary: boolean }
>;
