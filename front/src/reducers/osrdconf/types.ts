import type { Position } from 'geojson';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import type {
  ConsistData,
  MarginType,
  ArrivalTimeTypes,
  LinkedTrains,
  StdcmSearchDatetimeWindow,
  StdcmSimulation,
  StdcmStopTypes,
} from 'applications/stdcm/types';
import type {
  TrainCategory,
  Comfort,
  Distribution,
  LoadingGaugeType,
  RelatedOperationalPoint,
  PathItemLocation,
  ReceptionSignal,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { MapSettings } from 'reducers/commonMap/types';
import type { InfraState } from 'reducers/infra';
import type { Duration } from 'utils/duration';

export type OsrdConfState = InfraState & {
  projectID?: number;
  studyID?: number;
  scenarioID?: number;
  timetableID?: number;
  electricalProfileSetId?: number;
  rollingStockID?: number;
  speedLimitByTag?: string;
  mapSettings: MapSettings;
};

export type StandardAllowance = {
  type: MarginType;
  value?: number;
};

export type ItineraryForm = {
  name: string;
  category: TrainCategory | null;
  rollingStockId?: number;
  rollingStockName: string;
  speedLimitTag?: string;
  pathSteps: (PathStep | null)[];
  trainType?: OperationalStudiesConfState['editingTrainType'];
};

export type OperationalStudiesConfState = OsrdConfState & {
  name: string;
  category: TrainCategory | null;
  startTime: Date;
  initialSpeed?: number;
  labels: string[];
  rollingStockName: string;
  rollingStockComfort: Comfort;
  pathSteps: (PathStep | null)[];
  constraintDistribution: Distribution;
  usingElectricalProfiles: boolean;
  usingSpeedLimits: boolean;
  stopsAtEndOfBlock: boolean;
  powerRestriction: PowerRestriction[];
  timeWindow: Duration;
  interval: Duration;
  addedExceptions: {
    startTime: Date;
  }[];
  editingTrainType: 'uniqueTrain' | 'pacedTrain' | 'occurrence';
};

export type OsrdStdcmConfState = OsrdConfState & {
  stdcmPathSteps: StdcmPathStep[];
  margins: {
    standardAllowance?: StandardAllowance;
    gridMarginBefore?: Duration;
    gridMarginAfter?: Duration;
  };
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  loadingGauge?: LoadingGaugeType;
  lightRollingStockID?: number;
  towedRollingStockID?: number;
  linkedTrains: LinkedTrains;
  simulations: StdcmSimulation[];
  selectedSimulationIndex?: number;
  retainedSimulationIndex?: number;
  workScheduleGroupId?: number;
  temporarySpeedLimitGroupId?: number;
  searchDatetimeWindow?: StdcmSearchDatetimeWindow;
  operationalPoints?: number[];
  speedLimitsByTag: Record<string, number>;
  trackSectionIdsByLoadingGauge?: Record<string, string[]>;
  operationalPointsIdFiltered?: string[];
};

export type PathStep = {
  key: string;
  location: PathItemLocation;
  arrival?: Duration | null;
  stopFor?: Duration | null;
  theoreticalMargin?: string;
  receptionSignal?: ReceptionSignal;
  kp?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath?: number;
  coordinates?: Position;
  // Metadatas given by the search endpoint in TypeAndPath (name)
  name?: string;
  // Metadatas given by ManageTrainScheduleMap click event to add origin/destination/via
  metadata?: {
    lineCode: number;
    lineName: string;
    trackName: string;
    trackNumber: number;
  };
  isInvalid?: boolean;
  /** Flag specifying whether the pathStep was created from the power restriction selector or not
   *
   * If true, the pathStep might be cleaned if its power restriction is removed (except if it has time, stop or margin constraints)
   *
   * This flag will only work if the user has not saved their change. Once the change is saved, the flag will be removed and the pathStep
   * will become permanent.
   */
  isFromPowerRestriction?: boolean;
};

export type PathStepV2 = {
  key: string;
  location: PathItemLocation | null;
  arrival: Duration | null;
  stopFor: Duration | null;
  theoreticalMargin: string | null;
  receptionSignal: ReceptionSignal | null;
};

export type PathStepMetadata =
  | { isInvalid: true; localTrackName?: string; customTrackNames?: string[] }
  | {
      type: 'trackOffset';
      isInvalid: false;
      label: string;
      coordinates: Position;
    }
  | {
      type: 'opRef';
      isInvalid: false;
      name: string;
      /** Store the UIC for cases where we modify a step that was defined by an op id / trigram */
      uic?: number | null;
      /** Required when the corresponding path step is an operational_point since it won't
       * be in the path step location
       */
      secondaryCode?: string | null;
      /** Required when the corresponding path step has a track_reference with track_id since
       * we won't have access to the corresponding track name in the path step location
       */
      trackName?: string;
      /**
       * True when no local_track_name is provided, or when it matches one of the parts of the
       * matched OP. False only when a local_track_name is provided but does not match any part.
       */
      isValidLocalTrackName?: boolean;
      /**
       * Data of all parts (tracks) of the path step (name + ch).
       * - `valid`: comes from the infra (has trackId and coordinates)
       * - `custom`: track name only (timetable other-trains track names or user-entered names)
       */
      parts: (
        | { type: 'valid'; trackId: string; trackName: string; coordinates: Position }
        | { type: 'custom'; trackName: string }
      )[];
    };

export type StdcmPathStep = {
  id: string;
  operationalPoint?: {
    id: string;
    mainCode: string;
    uic: number;
    secondaryCode?: string | null;
    name: string;
    coordinates: [number, number];
    countryCode: string;
  };
} & (
  | {
      isVia: true;
      stopType: StdcmStopTypes;
      stopFor?: Duration;
      consistChange?: ConsistData;
    }
  | {
      isVia: false;
      arrivalType: ArrivalTimeTypes;
      // TODO: make arrival never undefined (/!\ store migration)
      /** undefined represents no user defined arrival constraint, null represents an invalid constraint */
      arrival?: Date | null;
      tolerances: { before: Duration; after: Duration };
    }
);

export type StdcmViaPathStep = Extract<StdcmPathStep, { isVia: true }>;

/**
 * Each regular occurrence id should follow this syntax : indexedoccurrence_{trainScheduleId}_{occurrenceIndex}
 * A regular occurrence is an occurrence that was originally part of the paced train.
 * It can have been disabled or turned into an exception by being modified (and disabled).
 */
export type IndexedOccurrenceId = string & { readonly __type: unique symbol };

/**
 * Each added exception id should follow this syntax : exception_{trainScheduleId}_{exceptionId}
 */
export type AddedExceptionId = string & { readonly __type: unique symbol };

/**
 * Regroup any occurrence id whether it is a regular occurrence or any kind of exception
 */
export type OccurrenceId = IndexedOccurrenceId | AddedExceptionId;

/**
 * Each TrainScheduleId should follow this syntax : trainSchedule_{id}
 */
export type TrainScheduleId = string & { readonly __type: unique symbol };

export type TrainId = OccurrenceId | TrainScheduleId;
export type TrainScheduleToEditData = {
  trainScheduleId: number;
  originalTrainSchedule: TrainScheduleWithDetails;
  occurrenceId?: OccurrenceId;
};

type TrainBaseWithTrainScheduleId = Omit<TrainScheduleResponse, 'id'> & {
  id: TrainScheduleId;
};
type TrainBaseWithOccurrenceId = Omit<TrainScheduleResponse, 'id'> & {
  id: OccurrenceId;
};

export type Train = TrainBaseWithTrainScheduleId | TrainBaseWithOccurrenceId;

export type TrainScheduleWithPathOps = TrainScheduleResponse & {
  pathOps: (RelatedOperationalPoint | null)[];
};
