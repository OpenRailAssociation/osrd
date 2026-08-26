import type { PathItemLocation, ReceptionSignal } from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { Duration, StartTime } from 'utils/duration';

import type { MarginUnit } from './consts';

export type MarginUnitType = (typeof MarginUnit)[keyof typeof MarginUnit];

export type MarginValue = {
  value: number;
  unit: MarginUnitType;
};

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

//TODO: rename TimesStopsRowNew to TimesStopsRow when deleting the old times stop input table.
export type TimesStopsRowNew = {
  // Identification
  /** Unique, opaque identifier for the row. Not to be confused with path step IDs or OP IDs. */
  id: string;
  /** Path step ID the row originates from, if any. null if it's an OP along the path not explicitly picked by the user. */
  pathStepId: string | null;
  opOnPathIndex: number;

  // Schedule information
  stepStatus: StepStatus;

  // Stop information
  name: string;
  secondaryCode?: string | null;
  track: string;

  // Path information
  /** True if the pathStep had an explicit track in its location (TrackOffset or local_track_name) */
  hasRequestedTrack: boolean;
  /** Location info to create a new PathItem when editing a waypoint that's not yet a pathStep */
  location: PathItemLocation;

  // Times
  requestedArrival: StartTime | null;
  computedArrival: StartTime | null;
  stopDuration: Duration | null;
  requestedDeparture: StartTime | null;
  computedDeparture: StartTime | null;

  // Signaling options
  closedSignal?: boolean;
  shortSlipDistance?: boolean;

  // Power restrictions
  powerRestriction: string | null;

  // Margins
  requestedTheoreticalMargin: MarginValue | undefined;
  isTheoreticalMarginBoundary: boolean | undefined;
  computedTheoreticalMarginSeconds: MarginValue | undefined;
  realMargin: MarginValue | undefined;
  marginsDifference: MarginValue | undefined;

  // Travel Times
  timeFromPreviousOp: Duration | null;
  totalTravelTime: Duration | null;

  baseArrival: StartTime | null;
};

export type TimesStopsRow = {
  pathStepId: string | undefined;
  opId: string | undefined;
  name: string | undefined;
  secondaryCode?: string | null;
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

export type StopPropagationMode = Exclude<PropagationMode, 'shiftAllWaypoints'>;

export type UpdateCellStatus = 'updated' | 'skipped';

export type ArrivalUpdate = {
  row: TimesStopsRowNew;
  field: 'requestedArrival';
  value: StartTime | null;
  propagationMode: PropagationMode;
};

export type StopDurationUpdate = {
  row: TimesStopsRowNew;
  field: 'stopDuration';
  value: number | null;
  propagationMode: StopPropagationMode;
};

export type DepartureUpdate = {
  row: TimesStopsRowNew;
  field: 'requestedDeparture';
  value: StartTime | null;
  propagationMode: PropagationMode;
};

export type ReceptionSignalUpdate = {
  row: TimesStopsRowNew;
  field: 'receptionSignal';
  value: ReceptionSignal | undefined;
};

export type RequestedMarginUpdate = {
  row: TimesStopsRowNew;
  field: 'requestedTheoreticalMargin';
  value: MarginValue | null;
};

export type PowerRestrictionUpdate = {
  row: TimesStopsRowNew;
  field: 'powerRestriction';
  value: string | null;
};

export type ReferenceBaseArrivalUpdate = {
  row: TimesStopsRowNew;
  field: 'referenceBaseArrival';
  value: StartTime | null;
  propagationMode: PropagationMode;
};

export type CellUpdate =
  | ArrivalUpdate
  | StopDurationUpdate
  | DepartureUpdate
  | ReceptionSignalUpdate
  | RequestedMarginUpdate
  | PowerRestrictionUpdate
  | ReferenceBaseArrivalUpdate;

export type OptimisticEdit =
  | { field: 'requestedArrival'; value: StartTime | null }
  | { field: 'requestedDeparture'; value: StartTime | null }
  | { field: 'stopDuration'; value: Duration | null }
  | { field: 'stopDurationWithArrival'; value: { stop: Duration | null; arrival: StartTime } }
  | { field: 'receptionSignal'; value: ReceptionSignal | undefined }
  | { field: 'requestedTheoreticalMargin'; value: MarginValue | null }
  | { field: 'powerRestriction'; value: string | null }
  | { field: 'referenceBaseArrival'; value: StartTime | null };

export type PendingEdit = OptimisticEdit & { rowId: string };

export type Margins<T = MarginValue> = {
  theoreticalMargin?: T;
  isTheoreticalMarginBoundary?: boolean;
  theoreticalMarginSeconds?: T;
  calculatedMargin?: T;
  diffMargins?: T;
};

type MarginsCoreBase = {
  theoreticalMargin: MarginValue;
  isBoundary: boolean;
};

export type MarginsCoreComputed = MarginsCoreBase & {
  provisionalLostTime: number;
  finalLostTime: number;
};

export type MarginsCore = null | MarginsCoreBase | MarginsCoreComputed;
