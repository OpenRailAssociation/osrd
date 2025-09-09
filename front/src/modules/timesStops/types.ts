import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { Duration } from 'utils/duration';
import type { ArrayElement } from 'utils/types';

export type TimeExtraDays = {
  time: TimeString;
  daySinceDeparture?: number;
  dayDisplayed?: boolean;
};

export type TimesStopsRow = {
  pathStepId: string | undefined;
  opId: string | undefined;
  name: string | undefined;
  ch?: string;
  trackName?: string;

  arrival?: TimeExtraDays; // value asked by user
  departure?: TimeExtraDays; // value asked by user
  stopFor?: Duration | null; // value asked by user
  onStopSignal?: boolean;
  shortSlipDistance?: boolean;
  theoreticalMargin?: string; // value asked by user
  isTheoreticalMarginBoundary?: boolean; // tells whether the theoreticalMargin value was inputted for this line or if it is repeated from a previous line

  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  calculatedArrival?: Date | null;
  calculatedDeparture?: Date | null;

  isMarginValid?: boolean;
};

export type TimesStopsInputRow = Pick<
  SuggestedOP,
  'uic' | 'positionOnPath' | 'offsetOnTrack' | 'track'
> &
  TimesStopsRow;

export enum TableType {
  Input = 'Input',
  Output = 'Output',
}

export type ScheduleEntry = ArrayElement<TrainSchedule['schedule']>;

export type TheoreticalMarginsRecord = Record<
  string,
  { theoreticalMargin: string; isBoundary: boolean }
>;
