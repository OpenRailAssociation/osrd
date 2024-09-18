import { compact } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  SearchResultItemOperationalPoint,
  SearchPayload,
  SearchQuery,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import nodeStore from './nodeStore';
import { findOpFromPathItem, addDurationToDate } from './utils';
import type {
  Node,
  Port,
  TimeLock,
  Trainrun,
  TrainrunSection,
  TrainrunCategory,
  TrainrunFrequency,
  TrainrunTimeCategory,
  NetzgrafikDto,
  Label,
  LabelGroup,
} from '../NGE/types';
import { PortAlignment } from '../NGE/types';

// TODO: make this optional in NGE since it's SBB-specific
const TRAINRUN_CATEGORY_HALTEZEITEN = {
  HaltezeitIPV: { haltezeit: 0, no_halt: false },
  HaltezeitA: { haltezeit: 0, no_halt: false },
  HaltezeitB: { haltezeit: 0, no_halt: false },
  HaltezeitC: { haltezeit: 0, no_halt: false },
  HaltezeitD: { haltezeit: 0, no_halt: false },
  HaltezeitUncategorized: { haltezeit: 0, no_halt: false },
};

const DEFAULT_LABEL_GROUP: LabelGroup = {
  id: 1,
  name: 'Default',
  labelRef: 'Trainrun',
};

const DEFAULT_TRAINRUN_CATEGORY: TrainrunCategory = {
  id: 1, // In NGE, Trainrun.DEFAULT_TRAINRUN_CATEGORY
  order: 0,
  name: 'Default',
  shortName: '', // TODO: find a better way to hide this in the graph
  fachCategory: 'HaltezeitUncategorized',
  colorRef: 'EC',
  minimalTurnaroundTime: 0,
  nodeHeadwayStop: 0,
  nodeHeadwayNonStop: 0,
  sectionHeadway: 0,
};

const DEFAULT_TRAINRUN_FREQUENCIES: TrainrunFrequency[] = [
  {
    id: 2,
    order: 0,
    frequency: 30,
    offset: 0,
    name: 'Half-hourly',
    shortName: '30',
    linePatternRef: '30',
  },
  {
    id: 3, // default NGE frequency takes id 3
    order: 1,
    frequency: 60,
    offset: 0,
    name: 'Hourly',
    /** Short name, needs to be unique */
    shortName: '60',
    linePatternRef: '60',
  },
  {
    id: 4,
    order: 2,
    frequency: 120,
    offset: 0,
    name: 'Two-hourly',
    shortName: '120',
    linePatternRef: '120',
  },
];

export const DEFAULT_TRAINRUN_FREQUENCY: TrainrunFrequency = DEFAULT_TRAINRUN_FREQUENCIES[1];

const DEFAULT_TRAINRUN_TIME_CATEGORY: TrainrunTimeCategory = {
  id: 0, // In NGE, Trainrun.DEFAULT_TRAINRUN_TIME_CATEGORY
  order: 0,
  name: 'Default',
  shortName: '7/24',
  dayTimeInterval: [],
  weekday: [1, 2, 3, 4, 5, 6, 7],
  linePatternRef: '7/24',
};

const DEFAULT_DTO: NetzgrafikDto = {
  resources: [],
  nodes: [],
  trainruns: [],
  trainrunSections: [],
  metadata: {
    netzgrafikColors: [],
    trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
    trainrunFrequencies: [...DEFAULT_TRAINRUN_FREQUENCIES],
    trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
  },
  freeFloatingTexts: [],
  labels: [],
  labelGroups: [],
  filterData: {
    filterSettings: [],
  },
};

const DEFAULT_TIME_LOCK: TimeLock = {
  time: null,
  consecutiveTime: null,
  lock: false,
  warning: null,
  timeFormatter: null,
};

/**
 * Build a search query to fetch all operational points from their UICs,
 * trigrams and IDs.
 */
const buildOpQuery = (
  infraId: number,
  trainSchedules: TrainScheduleResult[]
): SearchPayload | null => {
  const pathItems = trainSchedules.map((schedule) => schedule.path).flat();
  const pathItemQueries = [];
  const pathItemSet = new Set<string>();
  for (const item of pathItems) {
    let query: SearchQuery;
    if ('uic' in item) {
      query = ['=', ['uic'], item.uic];
      if (item.secondary_code) {
        query = ['and', query, ['=', ['ch'], item.secondary_code]];
      }
    } else if ('trigram' in item) {
      query = ['=', ['trigram'], item.trigram];
      if (item.secondary_code) {
        query = ['and', query, ['=', ['ch'], item.secondary_code]];
      }
    } else if ('operational_point' in item) {
      query = ['=', ['obj_id'], item.operational_point];
    } else {
      continue; // track offset, handled by creating an empty node
    }

    // Avoid including the same query twice in the search payload
    const key = JSON.stringify(query);
    if (pathItemSet.has(key)) {
      continue;
    }

    pathItemSet.add(key);
    pathItemQueries.push(query);
  }

  if (pathItemQueries.length === 0) {
    return null;
  }

  return {
    object: 'operationalpoint',
    query: ['and', ['=', ['infra_id'], infraId], ['or', ...pathItemQueries]],
  };
};

/**
 * Execute the search payload and collect all result pages.
 */
const executeSearch = async (
  searchPayload: SearchPayload,
  dispatch: AppDispatch
): Promise<SearchResultItemOperationalPoint[]> => {
  const pageSize = 100;
  let done = false;
  const searchResults: SearchResultItemOperationalPoint[] = [];
  for (let page = 1; !done; page += 1) {
    const searchPromise = dispatch(
      osrdEditoastApi.endpoints.postSearch.initiate({
        page,
        pageSize,
        searchPayload,
      })
    );
    const results = (await searchPromise.unwrap()) as SearchResultItemOperationalPoint[];
    searchResults.push(...results);
    done = results.length < pageSize;
  }
  return searchResults;
};

/**
 * Convert geographic coordinates (latitude/longitude) into screen coordinates
 * (pixels).
 */
const convertGeoCoords = (nodes: Node[]) => {
  const xCoords = nodes.map((node) => node.positionX);
  const yCoords = nodes.map((node) => node.positionY);
  const minX = Math.min(...xCoords);
  const minY = Math.min(...yCoords);
  const maxX = Math.max(...xCoords);
  const maxY = Math.max(...yCoords);
  const width = maxX - minX;
  const height = maxY - minY;
  // TODO: grab NGE component size
  const scaleX = 800;
  const scaleY = 500;
  const padding = 0.1;

  return nodes.map((node) => {
    const normalizedX = (node.positionX - minX) / (width || 1);
    const normalizedY = 1 - (node.positionY - minY) / (height || 1);
    const paddedX = normalizedX * (1 - 2 * padding) + padding;
    const paddedY = normalizedY * (1 - 2 * padding) + padding;
    return {
      ...node,
      positionX: scaleX * paddedX,
      positionY: scaleY * paddedY,
    };
  });
};

const importTimetable = async (
  infraId: number,
  timetableId: number,
  dispatch: AppDispatch
): Promise<NetzgrafikDto> => {
  const timetablePromise = dispatch(
    osrdEditoastApi.endpoints.getTimetableById.initiate({ id: timetableId })
  );
  const { train_ids } = await timetablePromise.unwrap();

  const trainSchedulesPromise = dispatch(
    osrdEditoastApi.endpoints.postTrainSchedule.initiate({
      body: { ids: train_ids },
    })
  );
  const trainSchedules = await trainSchedulesPromise.unwrap();

  const searchPayload = buildOpQuery(infraId, trainSchedules);
  const searchResults = searchPayload ? await executeSearch(searchPayload, dispatch) : [];

  const resource = {
    id: 1,
    capacity: trainSchedules.length,
  };

  let nodes: Node[] = [];
  const nodesById = new Map<number, Node>();
  let nodeId = 0;
  let nodePositionX = 0;
  const createNode = ({
    trigram,
    fullName,
    positionX,
    positionY,
  }: {
    trigram?: string;
    fullName?: string;
    positionX?: number;
    positionY?: number;
  }): Node => {
    if (positionX === undefined) {
      positionX = nodePositionX;
      nodePositionX += 200;
    }

    const node = {
      id: nodeId,
      betriebspunktName: trigram || '',
      fullName: fullName || '',
      positionX,
      positionY: positionY || 0,
      ports: [],
      transitions: [],
      connections: [],
      resourceId: resource.id,
      perronkanten: 10,
      connectionTime: 0,
      trainrunCategoryHaltezeiten: TRAINRUN_CATEGORY_HALTEZEITEN,
      symmetryAxis: 0,
      warnings: [],
      labelIds: [],
    };

    nodeId += 1;
    nodes.push(node);
    nodesById.set(node.id, node);

    return node;
  };

  const nodesByOpId = new Map<string, Node>();
  for (const op of searchResults) {
    const node = createNode({
      trigram: op.trigram + (op.ch ? `/${op.ch}` : ''),
      fullName: op.name,
      positionX: op.geographic.coordinates[0],
      positionY: op.geographic.coordinates[1],
    });
    nodesByOpId.set(op.obj_id, node);
  }

  nodes = convertGeoCoords(nodes);

  const DTOLabels: Label[] = [];
  // Create one NGE train run per OSRD train schedule
  let labelId = 0;
  const trainruns: Trainrun[] = trainSchedules.map((trainSchedule) => {
    const formatedLabels: (Label | undefined)[] = [];
    let trainrunFrequency: TrainrunFrequency | undefined;
    if (trainSchedule.labels) {
      trainSchedule.labels.forEach((label) => {
        // Frenquency labels management from OSRD (labels for moment manage 'frequency::30' and 'frequency::120')
        if (label.includes('frequency')) {
          const frequency = parseInt(label.split('::')[1], 10);
          if (!trainrunFrequency || trainrunFrequency.frequency > frequency) {
            const trainrunFrequencyFind = DEFAULT_TRAINRUN_FREQUENCIES.find(
              (freq) => freq.frequency === frequency
            );
            trainrunFrequency = trainrunFrequencyFind || trainrunFrequency;
          }
          return;
        }
        const DTOLabel = DTOLabels.find((DTOlabel) => DTOlabel.label === label);
        if (DTOLabel) {
          formatedLabels.push(DTOLabel);
        } else {
          const newDTOLabel: Label = {
            id: labelId,
            label,
            labelGroupId: DEFAULT_LABEL_GROUP.id,
            labelRef: 'Trainrun',
          };
          DTOLabels.push(newDTOLabel);
          labelId += 1;
          formatedLabels.push(newDTOLabel);
        }
      });
    }

    return {
      id: trainSchedule.id,
      name: trainSchedule.train_name,
      categoryId: DEFAULT_TRAINRUN_CATEGORY.id,
      frequencyId: trainrunFrequency?.id || DEFAULT_TRAINRUN_FREQUENCY.id,
      trainrunTimeCategoryId: DEFAULT_TRAINRUN_TIME_CATEGORY.id,
      labelIds: compact(formatedLabels).map((label) => label.id),
      trainrunFrequency: trainrunFrequency || DEFAULT_TRAINRUN_FREQUENCY,
    };
  });

  let portId = 0;
  const createPort = (trainrunSectionId: number) => {
    const port = {
      id: portId,
      trainrunSectionId,
      positionIndex: 0,
      positionAlignment: PortAlignment.Top,
    };
    portId += 1;
    return port;
  };

  let transitionId = 0;
  const createTransition = (port1Id: number, port2Id: number) => {
    const transition = {
      id: transitionId,
      port1Id,
      port2Id,
      isNonStopTransit: false,
    };
    transitionId += 1;
    return transition;
  };

  let trainrunSectionId = 0;
  const trainrunSections: TrainrunSection[] = trainSchedules
    .map((trainSchedule) => {
      // Figure out the node ID for each path item
      const pathNodeIds = trainSchedule.path.map((pathItem) => {
        const op = findOpFromPathItem(pathItem, searchResults);
        if (op) {
          return nodesByOpId.get(op.obj_id)!.id;
        }

        let trigram: string | undefined;
        if ('trigram' in pathItem) {
          trigram = pathItem.trigram;
          if (pathItem.secondary_code) {
            trigram += `/${pathItem.secondary_code}`;
          }
        }

        const node = createNode({ trigram });
        return node.id;
      });

      const startTime = new Date(trainSchedule.start_time);
      const createTimeLock = (time: Date): TimeLock => ({
        time: time.getMinutes(),
        // getTime() is in milliseconds, consecutiveTime is in minutes
        consecutiveTime: (time.getTime() - startTime.getTime()) / (60 * 1000),
        lock: false,
        warning: null,
        timeFormatter: null,
      });

      // OSRD describes the path in terms of nodes, NGE describes it in terms
      // of sections between nodes. Iterate over path items two-by-two to
      // convert them.
      let prevPort: Port | null = null;
      return pathNodeIds.slice(0, -1).map((sourceNodeId, i) => {
        const targetNodeId = pathNodeIds[i + 1];

        const sourcePort = createPort(trainrunSectionId);
        const targetPort = createPort(trainrunSectionId);

        const sourceNode = nodesById.get(sourceNodeId)!;
        const targetNode = nodesById.get(targetNodeId)!;
        sourceNode.ports.push(sourcePort);
        targetNode.ports.push(targetPort);

        const sourceScheduleEntry = trainSchedule.schedule!.find(
          (entry) => entry.at === trainSchedule.path[i].id
        );
        const targetScheduleEntry = trainSchedule.schedule!.find(
          (entry) => entry.at === trainSchedule.path[i + 1].id
        );

        // Create a transition between the previous section and the one we're
        // creating
        if (prevPort) {
          const transition = createTransition(prevPort.id, sourcePort.id);
          transition.isNonStopTransit = !sourceScheduleEntry?.stop_for;
          sourceNode.transitions.push(transition);
        }
        prevPort = targetPort;

        let sourceDeparture = { ...DEFAULT_TIME_LOCK };
        if (i === 0) {
          sourceDeparture = createTimeLock(startTime);
        } else if (sourceScheduleEntry && sourceScheduleEntry.arrival) {
          sourceDeparture = createTimeLock(
            addDurationToDate(
              addDurationToDate(startTime, sourceScheduleEntry.arrival),
              sourceScheduleEntry.stop_for || 'P0D'
            )
          );
        }

        let targetArrival = { ...DEFAULT_TIME_LOCK };
        if (targetScheduleEntry && targetScheduleEntry.arrival) {
          targetArrival = createTimeLock(addDurationToDate(startTime, targetScheduleEntry.arrival));
        }

        const travelTime = { ...DEFAULT_TIME_LOCK };
        if (targetArrival.time && sourceDeparture.time) {
          travelTime.time = (targetArrival.time - sourceDeparture.time + 60) % 60;
        }

        const trainrunSection = {
          id: trainrunSectionId,
          sourceNodeId,
          sourcePortId: sourcePort.id,
          targetNodeId,
          targetPortId: targetPort.id,
          travelTime,
          sourceDeparture,
          sourceArrival: { ...DEFAULT_TIME_LOCK },
          targetDeparture: { ...DEFAULT_TIME_LOCK },
          targetArrival,
          numberOfStops: 0,
          trainrunId: trainSchedule.id,
          resourceId: resource.id,
          path: {
            path: [],
            textPositions: [],
          },
          specificTrainrunSectionFrequencyId: 0,
          warnings: [],
        };
        trainrunSectionId += 1;

        return trainrunSection;
      });
    })
    .flat();

  // eslint-disable-next-line no-restricted-syntax
  for (const node of nodes) {
    // eslint-disable-next-line no-continue
    if (!node.betriebspunktName) continue;
    const savedNode = nodeStore.get(timetableId, node.betriebspunktName);
    if (savedNode) {
      node.positionX = savedNode.positionX;
      node.positionY = savedNode.positionY;
    }
  }

  return {
    ...DEFAULT_DTO,
    labels: DTOLabels,
    labelGroups: [DEFAULT_LABEL_GROUP],
    resources: [resource],
    metadata: {
      netzgrafikColors: [],
      trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
      trainrunFrequencies: DEFAULT_TRAINRUN_FREQUENCIES,
      trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
    },
    nodes,
    trainruns,
    trainrunSections,
  };
};

export default importTimetable;
