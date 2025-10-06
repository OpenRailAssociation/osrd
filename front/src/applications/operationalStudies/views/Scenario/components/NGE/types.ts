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
  direction: 'one_way' | 'round_trip';
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

/**
 * Represents a train category in NGE (Netzgrafik Editor).
 * Mandatory attribute for any Trainrun, used for filtering and visual representation (line color, style) of trains.
 * Some attributes are specific to NGE and not used in OSRD synchronization.
 */
export type TrainrunCategory = {
  /**
   * Unique identifier for the category.
   */
  id: number;

  /**
   * Display order for Category chips in NGE interface.
   */
  order: number;

  /**
   * Displayed on Category chip mouse hover.
   */
  name: string;

  /**
   * Abbreviated name for the category.
   * Short name, needs to be unique
   */
  shortName: string;

  /**
   * Category of stop time. Not used in OSRD.
   */
  fachCategory: string;

  /**
   * Reference to the color palette entry.
   * Used for visual representation of the different categories in NGE.
   * Must match a key in NETZGRAFIK_COLOR_PALETTE.
   */
  colorRef: string;

  /**
   * Minimum time required for a trainrun to start its backward journey after completing its forward journey. Not used in OSRD.
   */
  minimalTurnaroundTime: number;

  /**
   * Allocated time in front of the train at a station when the train stops, for track occupancy heuristics. Not used in OSRD.
   */
  nodeHeadwayStop: number;

  /**
   * Allocated time in front of the train at a station when the train does not stop, for track occupancy heuristics. Not used in OSRD.
   */
  nodeHeadwayNonStop: number;

  /**
   * Allocated time in front of the train between two nodes, for track occupancy heuristics. Not used in OSRD.
   */
  sectionHeadway: number;
};

/**
 * Mandatory attribute for any Trainrun.
 * Used for the `linePatternRef` attribute, which changes the line style of the Trainrun.
 * It is also used to compute the space-time diagram (Streckengrafik) of NGE.
 */
export type TrainrunFrequency = {
  /** At creation of a trainrun, default NGE frequency takes id 3. */
  id: number;
  /** Order for displaying Frequency chips in NGE. */
  order: number;
  /** Equivalent as `paced.interval` in OSRD. Unit is in minutes. */
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
  freeFloatingTexts: FreeFloatingTextDto[];
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
  | { objectType: 'note'; note: FreeFloatingTextDto }
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

export type FreeFloatingTextDto = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  text: string;
  backgroundColor: string;
  textColor: string;
  labelIds: number[];
};
