import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  SearchResultItemOperationalPoint,
  SearchPayload,
  SearchQuery,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import type {
  Node,
  TrainrunCategory,
  TrainrunFrequency,
  TrainrunTimeCategory,
  NetzgrafikDto,
} from './types';

// TODO: make this optional in NGE since it's SBB-specific
const TRAINRUN_CATEGORY_HALTEZEITEN = {
  HaltezeitIPV: { haltezeit: 0, no_halt: false },
  HaltezeitA: { haltezeit: 0, no_halt: false },
  HaltezeitB: { haltezeit: 0, no_halt: false },
  HaltezeitC: { haltezeit: 0, no_halt: false },
  HaltezeitD: { haltezeit: 0, no_halt: false },
  HaltezeitUncategorized: { haltezeit: 0, no_halt: false },
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

const DEFAULT_TRAINRUN_FREQUENCY: TrainrunFrequency = {
  id: 3, // In NGE, Trainrun.DEFAULT_TRAINRUN_FREQUENCY
  order: 0,
  frequency: 60,
  offset: 0,
  name: 'Default',
  /** Short name, needs to be unique */
  shortName: 'D',
  linePatternRef: '60',
};

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
    trainrunFrequencies: [DEFAULT_TRAINRUN_FREQUENCY],
    trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
  },
  freeFloatingTexts: [],
  labels: [],
  labelGroups: [],
  filterData: {
    filterSettings: [],
  },
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
  // eslint-disable-next-line no-restricted-syntax
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
      // eslint-disable-next-line no-continue
      continue; // track offset, handled by creating an empty node
    }

    // Avoid including the same query twice in the search payload
    const key = JSON.stringify(query);
    if (pathItemSet.has(key)) {
      // eslint-disable-next-line no-continue
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
    // eslint-disable-next-line no-await-in-loop
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
    const normalizedX = (node.positionX - minX) / width;
    const normalizedY = 1 - (node.positionY - minY) / height;
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
    osrdEditoastApi.endpoints.getV2TimetableById.initiate({ id: timetableId })
  );
  const { train_ids } = await timetablePromise.unwrap();

  const trainSchedulesPromise = dispatch(
    osrdEditoastApi.endpoints.postV2TrainSchedule.initiate({
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
  const nodesById = new Map<string | number, Node>();
  let nodeId = 0;
  let nodePositionX = 0;
  const createNode = ({
    id,
    trigram,
    fullName,
    positionX,
    positionY,
  }: {
    id?: string | number;
    trigram?: string;
    fullName?: string;
    positionX?: number;
    positionY?: number;
  }): Node => {
    if (id === undefined) {
      id = nodeId;
      nodeId += 1;
    }
    if (positionX === undefined) {
      positionX = nodePositionX;
      nodePositionX += 200;
    }

    const node = {
      id: id!,
      betriebspunktName: trigram || '',
      fullName: fullName || '',
      positionX: positionX!,
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

    nodes.push(node);
    nodesById.set(node.id, node);

    return node;
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const op of searchResults) {
    createNode({
      id: op.obj_id,
      trigram: op.trigram + (op.ch ? `/${op.ch}` : ''),
      fullName: op.name,
      positionX: op.geographic.coordinates[0],
      positionY: op.geographic.coordinates[1],
    });
  }

  nodes = convertGeoCoords(nodes);

  return {
    ...DEFAULT_DTO,
    resources: [resource],
    metadata: {
      netzgrafikColors: [],
      trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
      trainrunFrequencies: [DEFAULT_TRAINRUN_FREQUENCY],
      trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
    },
    nodes,
  };
};

export default importTimetable;
