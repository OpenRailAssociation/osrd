// NGE DTO types, see:
// https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/src/app/data-structures/business.data.structures.ts

export type Haltezeit = {
  haltezeit: number;
  no_halt: boolean;
};

export type Node = {
  id: string; // TODO: in NGE this is a number
  /** Trigram */
  betriebspunktName: string;
  fullName: string;
  positionX: number;
  positionY: number;
  ports: Port[];
  transitions: Transition[];
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

export type Port = {
  id: number;
  positionIndex: number;
  positionAlignment: PortAlignment;
  trainrunSectionId: number;
};

export type Transition = {
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

export type Trainrun = {
  id: number;
  name: string;
  categoryId: number;
  frequencyId: number;
  trainrunTimeCategoryId: number;
  labelIds: number[];
};

export type TimeLock = {
  time: number;
  consecutiveTime: number | null;
  lock: boolean;
  warning: null;
  timeFormatter: null;
};

export type TrainrunSection = {
id: number;
sourceNodeId: string;
sourcePortId: number;
  targetNodeId: string;
  targetPortId: number;
  travelTime: TimeLock;
  sourceDeparture: TimeLock;
  sourceArrival: TimeLock;
  targetDeparture: TimeLock;
  targetArrival: TimeLock;
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

export type TrainrunSectionOperation = {
id: number;
sourceNode: Node
sourceNodeId: string;
sourcePortId: number;
targetNode: Node
  targetNodeId: string;
  targetPortId: number;
  travelTime: TimeLock;
  sourceDeparture: TimeLock;
  sourceArrival: TimeLock;
  targetDeparture: TimeLock;
  targetArrival: TimeLock;
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

export type TrainrunFrequency = {
  id: number;
  order: number;
  frequency: number;
  offset: number;
  name: string;
  /** Short name, needs to be unique */
  shortName: string;
  linePatternRef: string;
};

export type TrainrunTimeCategory = {
  id: number;
  order: number;
  name: string;
  /** Short name, needs to be unique */
  shortName: string;
  dayTimeInterval: unknown[];
  weekday: number[];
  linePatternRef: string;
};

export type Resource = {
  id: number;
  capacity: number;
};

export type NetzgrafikDto = {
  nodes: Node[];
  trainrunSections: TrainrunSection[];
  trainruns: Trainrun[];
  resources: Resource[];
  metadata: {
    netzgrafikColors: unknown[];
    trainrunCategories: TrainrunCategory[];
    trainrunFrequencies: TrainrunFrequency[];
    trainrunTimeCategories: TrainrunTimeCategory[];
  };
  freeFloatingTexts: unknown[];
  labels: unknown[];
  labelGroups: unknown[];
  filterData: {
    filterSettings: unknown[];
  };
};