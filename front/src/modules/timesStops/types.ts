import type { PathItemLocation, ReceptionSignal } from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { Duration } from 'utils/duration';

export type TimeExtraDays = {
  time: TimeString;
  daySinceDeparture?: number;
  dayDisplayed?: boolean;
};

export type StepStatus =
  | 'invalidPathStep'
  | 'noSimulation'
  | 'scheduleNotHonored'
  | 'marginNotHonored'
  | 'allHonored';

export type TimesStopsRowNew = {
  // Identification
  id: string;
  opOnPathIndex: number;

  // Schedule information
  stepStatus: StepStatus;

  // Stop information
  name: string;
  secondaryCode: string;
  track: string;

  // Path information
  /** True if this row corresponds to a pathStep input, false if it's just a waypoint */
  isPathStep: boolean;
  /** True if the pathStep had an explicit track in its location (TrackOffset or local_track_name) */
  hasRequestedTrack: boolean;
  /** Location info to create a new PathItem when editing a waypoint that's not yet a pathStep */
  location: PathItemLocation;

  // Times
  requestedArrival: Date | null;
  computedArrival: Date | null;
  stopDuration: Duration | null;
  requestedDeparture: Date | null;
  computedDeparture: Date | null;

  // Signaling options
  closedSignal?: boolean;
  shortSlipDistance?: boolean;

  // Power restrictions
  powerRestriction: string | null;

  // Margins
  requestedTheoreticalMargin: string | null;
  isTheoreticalMarginBoundary: boolean;
  computedTheoreticalMarginSeconds: number | null;
  realMargin: Duration | null;
  marginsDifference: Duration | null;

  // Travel Times
  timeFromPreviousOp: Duration | null;
  totalTravelTime: Duration | null;
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

export type TheoreticalMarginsRecord = Record<
  string,
  { theoreticalMargin: string; isBoundary: boolean }
>;

export type PropagationMode =
  | 'shiftAllWaypoints'
  | 'fromDeparture'
  | 'atThisWaypoint'
  | 'toDestination';

export type ArrivalUpdate = {
  row: TimesStopsRowNew;
  field: 'requestedArrival';
  value: Date | null;
  propagationMode: PropagationMode;
};

export type StopDurationUpdate = {
  row: TimesStopsRowNew;
  field: 'stopDuration';
  value: number | null;
};

export type DepartureUpdate = {
  row: TimesStopsRowNew;
  field: 'requestedDeparture';
  value: Date | null;
  propagationMode: PropagationMode;
};

export type ReceptionSignalUpdate = {
  row: TimesStopsRowNew;
  field: 'receptionSignal';
  value: ReceptionSignal | undefined;
};

export type CellUpdate =
  | ArrivalUpdate
  | StopDurationUpdate
  | DepartureUpdate
  | ReceptionSignalUpdate;

export type OptimisticEdit =
  | { field: 'requestedArrival'; value: Date | null }
  | { field: 'requestedDeparture'; value: Date | null }
  | { field: 'stopDuration'; value: Duration | null }
  | { field: 'receptionSignal'; value: ReceptionSignal | undefined };

export type PendingEdit = OptimisticEdit & { rowId: string };
