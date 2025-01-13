import { uniqBy } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import buildOpSearchQuery from 'modules/operationalPoint/helpers/buildOpSearchQuery';
import type { AppDispatch } from 'store';
import { Duration, addDurationToDate } from 'utils/duration';

import MacroEditorState, { type NodeIndexed } from './MacroEditorState';
import { deleteMacroNodeByDbId, getSavedMacroNodes } from './utils';
import {
  type PortDto,
  type TimeLockDto,
  type TrainrunSectionDto,
  type TrainrunCategory,
  type TrainrunTimeCategory,
  type TrainrunFrequency,
  type NetzgrafikDto,
  type LabelGroupDto,
  PortAlignment,
  type LabelDto,
} from '../NGE/types';

const TRAINRUN_CATEGORY_HALTEZEITEN = {
  HaltezeitIPV: { haltezeit: 0, no_halt: false },
  HaltezeitA: { haltezeit: 0, no_halt: false },
  HaltezeitB: { haltezeit: 0, no_halt: false },
  HaltezeitC: { haltezeit: 0, no_halt: false },
  HaltezeitD: { haltezeit: 0, no_halt: false },
  HaltezeitUncategorized: { haltezeit: 0, no_halt: false },
};

const TRAINRUN_LABEL_GROUP: LabelGroupDto = {
  id: 1,
  name: 'Default',
  labelRef: 'Trainrun',
};
const NODE_LABEL_GROUP: LabelGroupDto = {
  id: 2,
  name: 'Node',
  labelRef: 'Node',
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

export const DEFAULT_TRAINRUN_FREQUENCIES: TrainrunFrequency[] = [
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

const DEFAULT_TIME_LOCK: TimeLockDto = {
  time: null,
  consecutiveTime: null,
  lock: false,
  warning: null,
  timeFormatter: null,
};

/**
 * Execute the search payload and collect all result pages.
 */
const executeSearch = async (
  state: MacroEditorState,
  dispatch: AppDispatch
): Promise<SearchResultItemOperationalPoint[]> => {
  const searchPayload = buildOpSearchQuery(state.scenario.infra_id, state.trainSchedules);
  if (!searchPayload) {
    return [];
  }
  const pageSize = 100;
  let done = false;
  const searchResults: SearchResultItemOperationalPoint[] = [];
  for (let page = 1; !done; page += 1) {
    const searchPromise = dispatch(
      osrdEditoastApi.endpoints.postSearch.initiate(
        {
          page,
          pageSize,
          searchPayload,
        },
        { track: false }
      )
    );
    const results = (await searchPromise.unwrap()) as SearchResultItemOperationalPoint[];
    searchResults.push(...results);
    done = results.length < pageSize;
  }
  return searchResults;
};

/**
 * Apply a layout on nodes and save the new position.
 * Nodes that are saved are fixed.
 */
const applyLayout = (state: MacroEditorState) => {
  const indexedNodes = uniqBy(
    state.trainSchedules.flatMap((ts) => ts.path),
    MacroEditorState.getPathKey
  ).map((pathItem) => {
    const key = MacroEditorState.getPathKey(pathItem);
    return state.getNodeByKey(key)!;
  });

  const geoNodes = indexedNodes.filter((n) => n.geocoord);
  const xCoords = geoNodes.map((n) => n.geocoord!.lng);
  const yCoords = geoNodes.map((n) => n.geocoord!.lat);
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

  for (const n of indexedNodes) {
    if (!n.dbId && n.geocoord !== undefined) {
      const normalizedX = (n.geocoord.lng - minX) / (width || 1);
      const normalizedY = 1 - (n.geocoord.lat - minY) / (height || 1);
      const paddedX = normalizedX * (1 - 2 * padding) + padding;
      const paddedY = normalizedY * (1 - 2 * padding) + padding;
      state.updateNodeDataByKey(n.path_item_key, {
        position_x: Math.round(scaleX * paddedX),
        position_y: Math.round(scaleY * paddedY),
      });
    }
  }
};

/**
 * Cast a node into NGE format.
 */
const castNodeToNge = (
  state: MacroEditorState,
  node: NodeIndexed,
  labels: LabelDto[]
): NetzgrafikDto['nodes'][0] => ({
  id: node.ngeId,
  betriebspunktName: node.trigram || '',
  fullName: node.full_name || '',
  positionX: node.position_x,
  positionY: node.position_y,
  ports: [],
  transitions: [],
  connections: [],
  resourceId: state.ngeResource.id,
  perronkanten: 10,
  connectionTime: node.connection_time,
  trainrunCategoryHaltezeiten: TRAINRUN_CATEGORY_HALTEZEITEN,
  symmetryAxis: 0,
  warnings: [],
  labelIds: (node.labels || []).map((l) =>
    labels.findIndex((e) => e.label === l && e.labelGroupId === NODE_LABEL_GROUP.id)
  ),
});

/**
 * Load & index the data of the train schedule for the given scenario
 */
export const loadAndIndexNge = async (
  state: MacroEditorState,
  dispatch: AppDispatch
): Promise<void> => {
  // Load path items
  let nbNodesIndexed = 0;
  state.trainSchedules
    .flatMap((train) => train.path)
    .forEach((pathItem, index) => {
      const key = MacroEditorState.getPathKey(pathItem);
      if (!state.getNodeByKey(key)) {
        const macroNode: NodeIndexed = {
          ngeId: index,
          path_item_key: key,
          connection_time: 0,
          labels: [],
          // we put the nodes on a grid
          position_x: (nbNodesIndexed % 8) * 200,
          position_y: Math.trunc(nbNodesIndexed / 8),
        };
        state.indexNodeByKey(key, macroNode);
        nbNodesIndexed += 1;
      }
    });

  // Enhance nodes by calling the search API
  const searchResults = await executeSearch(state, dispatch);
  searchResults.forEach((searchResult) => {
    const macroNode = {
      fullName: searchResult.name,
      trigram: searchResult.trigram + (searchResult.ch ? `/${searchResult.ch}` : ''),
      geocoord: {
        lng: searchResult.geographic.coordinates[0],
        lat: searchResult.geographic.coordinates[1],
      },
    };
    MacroEditorState.getPathKeys(searchResult).forEach((pathKey) => {
      state.updateNodeDataByKey(pathKey, macroNode);
    });
  });

  // Load saved nodes and update the indexed nodes
  // If a saved node is not present in the train schedule, we delete it
  // this can happen if we delete a TS on which a node was saved
  const savedNodes = await getSavedMacroNodes(state, dispatch);
  await Promise.all(
    savedNodes.map(async (n) => {
      if (state.getNodeByKey(n.path_item_key) !== null) {
        state.updateNodeDataByKey(n.path_item_key, { ...n, dbId: n.id });
      } else {
        await deleteMacroNodeByDbId(state, dispatch, n.id);
      }
    })
  );

  // Dedup nodes
  state.dedupNodes();

  // Index trainschedule labels
  state.trainSchedules.forEach((ts) => {
    ts.labels?.forEach((l) => {
      state.trainrunLabels.add(l);
    });
  });

  // Now that we have all nodes, we apply a layout
  applyLayout(state);
};

/**
 * Translate the train schedule in NGE "trainruns".
 */
const getNgeTrainruns = (state: MacroEditorState, labels: LabelDto[]) =>
  state.trainSchedules
    .filter((trainSchedule) => trainSchedule.path.length >= 2)
    .map((trainSchedule) => ({
      id: trainSchedule.id,
      name: trainSchedule.train_name,
      categoryId: DEFAULT_TRAINRUN_CATEGORY.id,
      frequencyId: DEFAULT_TRAINRUN_FREQUENCY.id,
      trainrunTimeCategoryId: DEFAULT_TRAINRUN_TIME_CATEGORY.id,
      labelIds: (trainSchedule.labels || []).map((l) =>
        labels.findIndex((e) => e.label === l && e.labelGroupId === TRAINRUN_LABEL_GROUP.id)
      ),
    }));

/**
 * Translate the train schedule in NGE "trainrunSection" & "nodes".
 * It is needed to return the nodes as well, because we add ports & transitions on them
 */
const getNgeTrainrunSectionsWithNodes = (state: MacroEditorState, labels: LabelDto[]) => {
  let portId = 1;
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

  let transitionId = 1;
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

  // Track nge nodes
  const ngeNodesByPathKey: Record<string, NetzgrafikDto['nodes'][0]> = {};
  let trainrunSectionId = 0;
  const trainrunSections: TrainrunSectionDto[] = state.trainSchedules.flatMap((trainSchedule) => {
    // Figure out the primary node key for each path item
    const pathNodeKeys = trainSchedule.path.map((pathItem) => {
      const node = state.getNodeByKey(MacroEditorState.getPathKey(pathItem));
      return node!.path_item_key;
    });

    const startTime = new Date(trainSchedule.start_time);
    const createTimeLock = (time: Date): TimeLockDto => ({
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
    let prevPort: PortDto | null = null;
    return pathNodeKeys.slice(0, -1).map((sourceNodeKey, i) => {
      // Get the source node or created it
      if (!ngeNodesByPathKey[sourceNodeKey]) {
        ngeNodesByPathKey[sourceNodeKey] = castNodeToNge(
          state,
          state.getNodeByKey(sourceNodeKey)!,
          labels
        );
      }
      const sourceNode = ngeNodesByPathKey[sourceNodeKey];

      // Get the target node or created it
      const targetNodeKey = pathNodeKeys[i + 1];
      if (!ngeNodesByPathKey[targetNodeKey]) {
        ngeNodesByPathKey[targetNodeKey] = castNodeToNge(
          state,
          state.getNodeByKey(targetNodeKey)!,
          labels
        );
      }
      const targetNode = ngeNodesByPathKey[targetNodeKey];

      // Adding port
      const sourcePort = createPort(trainrunSectionId);
      sourceNode.ports.push(sourcePort);
      const targetPort = createPort(trainrunSectionId);
      targetNode.ports.push(targetPort);

      // Adding schedule
      const sourceScheduleEntry = trainSchedule.schedule!.find(
        (entry) => entry.at === trainSchedule.path[i].id
      );
      const targetScheduleEntry = trainSchedule.schedule!.find(
        (entry) => entry.at === trainSchedule.path[i + 1].id
      );

      // Create a transition between the previous section and the one we're creating
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
        const arrival = Duration.parse(sourceScheduleEntry.arrival);
        const stopFor = sourceScheduleEntry.stop_for
          ? Duration.parse(sourceScheduleEntry.stop_for)
          : Duration.zero;
        sourceDeparture = createTimeLock(
          addDurationToDate(addDurationToDate(startTime, arrival), stopFor)
        );
      }

      let targetArrival = { ...DEFAULT_TIME_LOCK };
      if (targetScheduleEntry && targetScheduleEntry.arrival) {
        const arrival = Duration.parse(targetScheduleEntry.arrival);
        targetArrival = createTimeLock(addDurationToDate(startTime, arrival));
      }

      const travelTime = { ...DEFAULT_TIME_LOCK };
      if (targetArrival.consecutiveTime !== null && sourceDeparture.consecutiveTime !== null) {
        travelTime.time = targetArrival.consecutiveTime - sourceDeparture.consecutiveTime;
        travelTime.consecutiveTime = travelTime.time;
      }

      const trainrunSection = {
        id: trainrunSectionId,
        sourceNodeId: sourceNode.id,
        sourcePortId: sourcePort.id,
        targetNodeId: targetNode.id,
        targetPortId: targetPort.id,
        travelTime,
        sourceDeparture,
        sourceArrival: { ...DEFAULT_TIME_LOCK },
        targetDeparture: { ...DEFAULT_TIME_LOCK },
        targetArrival,
        numberOfStops: 0,
        trainrunId: trainSchedule.id,
        resourceId: state.ngeResource.id,
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
  });

  return {
    trainrunSections,
    nodes: Object.values(ngeNodesByPathKey),
  };
};

const getNgeLabels = (state: MacroEditorState): LabelDto[] => [
  ...Array.from(state.nodeLabels).map((l, i) => ({
    id: i,
    label: l,
    labelGroupId: NODE_LABEL_GROUP.id,
    labelRef: 'Node',
  })),
  ...Array.from(state.trainrunLabels).map((l, i) => ({
    id: i,
    label: l,
    labelGroupId: TRAINRUN_LABEL_GROUP.id,
    labelRef: 'Trainrun',
  })),
];

/**
 * Return a compatible object for NGE
 */
export const getNgeDto = (state: MacroEditorState): NetzgrafikDto => {
  const labels = getNgeLabels(state);
  return {
    ...DEFAULT_DTO,
    labels,
    labelGroups: [NODE_LABEL_GROUP, TRAINRUN_LABEL_GROUP],
    resources: [state.ngeResource],
    metadata: {
      netzgrafikColors: [],
      trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
      trainrunFrequencies: [DEFAULT_TRAINRUN_FREQUENCY],
      trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
    },
    trainruns: getNgeTrainruns(state, labels),
    ...getNgeTrainrunSectionsWithNodes(state, labels),
  };
};
