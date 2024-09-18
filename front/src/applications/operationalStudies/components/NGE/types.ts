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
