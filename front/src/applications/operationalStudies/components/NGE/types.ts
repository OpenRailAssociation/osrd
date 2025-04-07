// NGE DTO types, see:
// https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/src/app/data-structures/business.data.structures.ts

export type Haltezeit = {
  haltezeit: number;
  no_halt: boolean;
};

export type NodeDto = {
  id: number;
  /** Trigram */
  betriebspunktName: string;
  fullName: string;
  positionX: number;
  positionY: number;
  ports: PortDto[];
  transitions: TransitionDto[];
  connections: unknown[];
  resourceId: number;
  /** Number of tracks where train can stop */
  perronkanten: number;
  /** Time needed to change train in minutes */
  connectionTime: number;
  trainrunCategoryHaltezeiten: { [category: string]: Haltezeit };
  symmetryAxis: number;
  warnings: unknown[];
  labelIds: number[];
};

export type PortDto = {
  id: number;
  positionIndex: number;
  positionAlignment: PortAlignment;
  trainrunSectionId: number;
};

export type TransitionDto = {
  id: number;
  port1Id: number;
  port2Id: number;
  isNonStopTransit: boolean;
};

export enum PortAlignment {
  Top,
  Bottom,
  Left,
  Right,
}

export type TrainrunDto = {
  id: number;
  name: string;
  categoryId: number;
  frequencyId: number;
  trainrunTimeCategoryId: number;
  labelIds: (number | string)[];
};

export type TimeLockDto = {
  time: number | null;
  consecutiveTime: number | null;
  lock: boolean;
  warning: null;
  timeFormatter: null;
};

export type TrainrunSectionDto = {
  id: number;
  sourceNodeId: number;
  sourcePortId: number;
  targetNodeId: number;
  targetPortId: number;

  sourceDeparture: TimeLockDto;
  sourceArrival: TimeLockDto;
  targetDeparture: TimeLockDto;
  targetArrival: TimeLockDto;
  travelTime: TimeLockDto;

  numberOfStops: number;

  trainrunId: number;
  resourceId: number;

  specificTrainrunSectionFrequencyId: number;
  path: {
    path: unknown[];
    textPositions: unknown[];
  };
  warnings: unknown[];
};

export type TrainrunCategory = {
  id: number;
  order: number;
  name: string;
  /** Short name, needs to be unique */
  shortName: string;
  fachCategory: string;
  colorRef: string;
  minimalTurnaroundTime: number;
  nodeHeadwayStop: number;
  nodeHeadwayNonStop: number;
  sectionHeadway: number;
};

/**
 * Mandatory attribute for any Trainrun.
 * Used for the `linePatternRef` attribute, which changes the line style of the Trainrun.
 * It is also used to compute the space-time diagram (Streckengrafik) of NGE.
 * The main types of TimetableItems are to be displayed:
 * - `TrainSchedule` -> `TrainrunFrequency.linePatternRef = '120'`
 * - `PacedTrain`:
 *    - `paced.step = 30` -> `TrainrunFrequency.linePatternRef = '30'`
 *    - `paced.step = 60` -> `TrainrunFrequency.linePatternRef = '60'`
 *    - `paced.step = 120` -> `TrainrunFrequency.linePatternRef = '120'`
 *    - `paced.step = anything else` -> `TrainrunFrequency.linePatternRef = '60'`
 */
export type TrainrunFrequency = {
  /** At creation of a trainrun, default NGE frequency takes id 3. */
  id: number;
  /** Order for displaying Frequency chips in NGE. */
  order: number;
  /** Equivalent as `paced.step` in OSRD. */
  frequency: number;
  /** Offset in minutes from minute 0, to 120min duration. */
  offset: number;
  /** Displayed on Frequency chip mouse hover. */
  name: string;
  /** Short name, needs to be unique. */
  shortName: string;
  /** Line style for Trainrun (dotted/single/double/triple/quadruple). Refs correspond to an enum in NGE. */
  linePatternRef: string;
};

/**
 * Mandatory attribute for any Trainrun.
 * Not used as its functionnality is meant to be, nor displayed, in OSRD yet.
 * Only used for the `linePatternRef` attribute, which changes the line style of the Trainrun.
 * The main types of TimetableItems are to be displayed:
 * - `TrainSchedule` -> `TrainrunTimeCategory.linePatternRef = 'ZEITWEISE'`
 * - `PacedTrain`:
 *    - `paced.step = 30` -> `TrainrunTimeCategory.linePatternRef = '7/24'`
 *    - `paced.step = 60` -> `TrainrunTimeCategory.linePatternRef = '7/24'`
 *    - `paced.step = 120` -> `TrainrunTimeCategory.linePatternRef = '7/24'`
 *    - `paced.step = anything else` -> `TrainrunTimeCategory.linePatternRef = 'HVZ'`
 */
export type TrainrunTimeCategory = {
  id: number;
  /** Order for displaying TimeCategory chips in NGE. */
  order: number;
  /** Displayed on TimeCategory chip mouse hover. */
  name: string;
  /** Short name, needs to be unique */
  shortName: string;
  dayTimeInterval: unknown[];
  weekday: number[];
  /** Line style for Trainrun (plain/dotted/dashed). Refs correspond to an enum in NGE. */
  linePatternRef: string;
};

export type ResourceDto = {
  id: number;
  capacity: number;
};

/**
 * The DTO contains the entire NGE state.
 */
export type NetzgrafikDto = {
  nodes: NodeDto[];
  trainrunSections: TrainrunSectionDto[];
  trainruns: TrainrunDto[];
  resources: ResourceDto[];
  metadata: {
    netzgrafikColors: unknown[];
    trainrunCategories: TrainrunCategory[];
    trainrunFrequencies: TrainrunFrequency[];
    trainrunTimeCategories: TrainrunTimeCategory[];
  };
  freeFloatingTexts: unknown[];
  labels: LabelDto[];
  labelGroups: LabelGroupDto[];
  filterData: {
    filterSettings: unknown[];
  };
};

export type NGEEvent = {
  type: 'create' | 'delete' | 'update';
} & (
  | {
      objectType: 'trainrun';
      trainrun: TrainrunDto;
    }
  | { objectType: 'node'; node: NodeDto }
  | { objectType: 'label'; label: LabelDto }
);

export type LabelDto = {
  id: number | string;
  label: string;
  labelGroupId: number;
  labelRef: string;
};

export type LabelGroupDto = {
  id: number;
  name: string;
  labelRef: string;
};
