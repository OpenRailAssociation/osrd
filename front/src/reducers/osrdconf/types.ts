import type { Geometry, Position } from 'geojson';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import type {
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
  OperationalPointReference,
  PacedTrain,
  PathItemLocation,
  ReceptionSignal,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainWithDetails } from 'modules/timetableItem/types';
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

export type OperationalStudiesConfState = OsrdConfState & {
  name: string;
  category: TrainCategory | null;
  startTime: Date;
  initialSpeed?: number;
  labels: string[];
  rollingStockComfort: Comfort;
  pathSteps: (PathStep | null)[];
  constraintDistribution: Distribution;
  usingElectricalProfiles: boolean;
  usingSpeedLimits: boolean;
  powerRestriction: PowerRestriction[];
  timeWindow: Duration;
  interval: Duration;
  addedExceptions: {
    key: string;
    startTime: Date;
  }[];
  editingItemType: 'trainSchedule' | 'pacedTrain' | 'occurrence';
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
  loadingGauge: LoadingGaugeType;
  towedRollingStockID?: number;
  linkedTrains: LinkedTrains;
  simulations: StdcmSimulation[];
  selectedSimulationIndex?: number;
  retainedSimulationIndex?: number;
  workScheduleGroupId?: number;
  temporarySpeedLimitGroupId?: number;
  searchDatetimeWindow?: StdcmSearchDatetimeWindow;
  activePerimeter?: Geometry;
  operationalPoints?: number[];
  speedLimitTags?: Record<string, number>;
  defaultSpeedLimitTag?: string;
};

export type PathStep = {
  id: string;
  location: PathItemLocation;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: Duration | null;
  locked?: boolean;
  stopFor?: Duration | null;
  theoreticalMargin?: string;
  receptionSignal?: ReceptionSignal;
  kp?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath?: number;
  coordinates?: Position;
  // Metadatas given by the search endpoint in TypeAndPath (name)
  name?: string;
  // Metadatas given by ManageTimetableItemMap click event to add origin/destination/via
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
  id: string;
  location: PathItemLocation | null;
  arrival: Duration | null;
  stopFor: Duration | null;
  theoreticalMargin: string | null;
  receptionSignal: ReceptionSignal | null;
};

export type PathStepMetadata =
  | { isInvalid: true }
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
      uic?: number;
      /** Required when the corresponding path step is an operational_point since it won't
       * be in the path step location
       */
      secondaryCode?: string;
      /** Required when the corresponding path step has a track_reference with track_id since
       * we won't have access to the corresponding track name in the path step location
       */
      trackName?: string;
      /**
       * An OperationalPoint is not unique by its UIC but by its UIC + secondary code.
       *
       * However, it can contains multiple parts since it can be referenced on multiple tracks.
       *
       * This Map stores all possible locations for a given op's secondary code.
       */
      locationsBySecondaryCode: Map<
        string,
        { trackId: string; trackName: string; lineName: string; coordinates: Position }[]
      >;
    };

export type StdcmPathStep = {
  id: string;
  location?: Extract<OperationalPointReference, { uic: number }> & {
    trigram: string;
    secondary_code: string;
    name: string;
    coordinates: [number, number];
  };
} & (
  | { isVia: true; stopType: StdcmStopTypes; stopFor?: Duration }
  | {
      isVia: false;
      arrivalType: ArrivalTimeTypes;
      // TODO: make arrival non nullable (/!\ store migration)
      arrival?: Date;
      tolerances: { before: Duration; after: Duration };
    }
);

/**
 * Each train schedule id should follow this syntax : trainschedule_{id}
 */
export type TrainScheduleId = string & { readonly __type: unique symbol };

/**
 * Each regular occurrence id should follow this syntax : indexedoccurrence_{pacedTrainId}_{occurrenceIndex}
 * A regular occurrence is an occurrence that was originally part of the paced train.
 * It can have been disabled or turned into an exception by being modified (and disabled).
 */
export type IndexedOccurrenceId = string & { readonly __type: unique symbol };

/**
 * Each added exception id should follow this syntax : exception_{pacedTrainId}_{exceptionId}
 */
export type AddedExceptionId = string & { readonly __type: unique symbol };

/**
 * Regroup any occurrence id whether it is a regular occurrence or any kind of exception
 */
export type OccurrenceId = IndexedOccurrenceId | AddedExceptionId;

/**
 * Each paced train id should follow this syntax : paced_{id}
 */
export type PacedTrainId = string & { readonly __type: unique symbol };

export type TrainId = TrainScheduleId | OccurrenceId;
export type TimetableItemId = TrainScheduleId | PacedTrainId;
export type TimetableItemToEditData =
  | {
      timetableItemId: TrainScheduleId;
    }
  | {
      timetableItemId: PacedTrainId;
      originalPacedTrain: PacedTrainWithDetails;
      occurrenceId?: OccurrenceId;
    };

export type TrainScheduleWithTrainId = TrainSchedule & {
  id: TrainScheduleId;
};

export type PacedTrainWithPacedTrainId = PacedTrain & {
  id: PacedTrainId;
};
export type TrainBaseWithOccurrenceId = TrainSchedule & {
  id: OccurrenceId;
};

export type TimetableItem = TrainScheduleWithTrainId | PacedTrainWithPacedTrainId;
export type Train = TrainScheduleWithTrainId | TrainBaseWithOccurrenceId;

export type TimetableItemWithPathOps = TimetableItem & { pathOps: RelatedOperationalPoint[][] };
