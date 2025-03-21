import type { TFunction } from 'i18next';
import { uniqBy } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SearchResultItemOperationalPoint, TrainSchedule } from 'common/api/osrdEditoastApi';
import buildOpSearchQuery from 'modules/operationalPoint/helpers/buildOpSearchQuery';
import type { AppDispatch } from 'store';
import { Duration, addDurationToDate } from 'utils/duration';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';

import {
  TRAINRUN_CATEGORY_HALTEZEITEN,
  NODE_LABEL_GROUP,
  DEFAULT_TRAINRUN_CATEGORY,
  TRAINRUN_LABEL_GROUP,
  DEFAULT_TIME_LOCK,
  DEFAULT_TRAINRUN_TIME_CATEGORIES,
} from './consts';
import MacroEditorState, { type NodeIndexed } from './MacroEditorState';
import {
  deleteMacroNodeByDbId,
  getDefaultTrainrunFrequencies,
  getSavedMacroNodes,
  getTrainrunFrequencyFromTimetableItem,
  getTrainrunTimeCategoryFromFrequency,
} from './utils';
import {
  type PortDto,
  type TimeLockDto,
  type TrainrunSectionDto,
  type TrainrunFrequency,
  type NetzgrafikDto,
  PortAlignment,
  type LabelDto,
} from '../NGE/types';

/**
 * Get the TrainrunFrequencies from the TimetableItems.
 * We need to add the unknown frequencies from the PacedTrains.
 */
const getNgeTrainrunFrequencies = (
  state: MacroEditorState,
  t: TFunction<'operationalStudies/scenario'>
): TrainrunFrequency[] => {
  // Get the default frequencies (TrainSchedule/30min/60min/120min)
  const trainrunFrequencies = getDefaultTrainrunFrequencies(t);

  // Add the unknown frequencies from the PacedTrains
  state.timetableItems.forEach((timetableItem) => {
    if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
      const intervalInMinutes = Duration.parse(timetableItem.paced.interval).total('minute');
      if (!trainrunFrequencies.find((f) => f.frequency === intervalInMinutes)) {
        const newFrequency: TrainrunFrequency = {
          id: trainrunFrequencies.length + 1,
          order: 0, // temporary order
          frequency: intervalInMinutes,
          offset: 0,
          name: t('macroEditor.intervalXmin', { minutes: intervalInMinutes }),
          shortName: `${intervalInMinutes}`,
          linePatternRef: '60',
        };
        trainrunFrequencies.push(newFrequency);
      }
    }
  });

  // Sort and re-order the frequencies
  trainrunFrequencies.sort((a, b) => a.frequency - b.frequency);
  trainrunFrequencies.forEach((frequency, index) => {
    frequency.order = index + 1;
  });

  return trainrunFrequencies;
};

/**
 * Execute the search payload and collect all result pages.
 */
const executeSearch = async (
  state: MacroEditorState,
  dispatch: AppDispatch
): Promise<SearchResultItemOperationalPoint[]> => {
  const pathSteps: TrainSchedule['path'] = state.timetableItems.flatMap(
    (timetableItem) => timetableItem.path
  );
  const searchPayload = buildOpSearchQuery(state.scenario.infra_id, pathSteps);
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
    state.timetableItems.flatMap((timetableItem) => timetableItem.path),
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
 * Load & index the data of the timetableItem for the given scenario.
 */
export const loadAndIndexNge = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  t: TFunction<'operationalStudies/scenario'>
): Promise<void> => {
  // Load path items
  let nbNodesIndexed = 0;
  state.timetableItems
    .flatMap((timetableItem) => timetableItem.path)
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
    const macroNode: Pick<NodeIndexed, 'full_name' | 'trigram' | 'geocoord'> = {
      full_name: searchResult.name,
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
  // If a saved node is not present in the timetableItems, we delete it.
  // This can happen if we delete a timetableItem on which a node was saved.
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

  // Index timetableItems labels
  state.timetableItems.forEach((timetableItem) => {
    timetableItem.labels?.forEach((l) => {
      state.trainrunLabels.add(l);
    });
  });

  // Initialize TrainrunFrequencies
  state.trainrunFrequencies = getNgeTrainrunFrequencies(state, t);

  // Now that we have all nodes, we apply a layout
  applyLayout(state);
};

/**
 * Translate the TimetableItems of OSRD into NGE Trainruns.
 */
const getNgeTrainruns = (state: MacroEditorState, labels: LabelDto[]) =>
  state.timetableItems
    .filter((timetableItem) => timetableItem.path.length >= 2)
    .map((timetableItem, index) => {
      state.timetableItemIdByNgeId.set(index + 1, timetableItem.id);
      const trainrunFrequency = getTrainrunFrequencyFromTimetableItem(timetableItem, state);
      return {
        id: index + 1,
        name: timetableItem.train_name,
        categoryId: DEFAULT_TRAINRUN_CATEGORY.id,
        frequencyId: trainrunFrequency.id,
        trainrunTimeCategoryId: getTrainrunTimeCategoryFromFrequency(trainrunFrequency).id,
        labelIds: (timetableItem.labels || []).map((l) =>
          labels.findIndex((e) => e.label === l && e.labelGroupId === TRAINRUN_LABEL_GROUP.id)
        ),
      };
    });

/**
 * Translate the TimetableItem in NGE "TrainrunSection" & "Nodes".
 * It is needed to return the nodes as well, because we add ports & transitions on them.
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
  const trainrunSections: TrainrunSectionDto[] = state.timetableItems.flatMap(
    (timetableItem, index) => {
      // Figure out the primary node key for each path item
      const pathNodeKeys = timetableItem.path.map((pathItem) => {
        const node = state.getNodeByKey(MacroEditorState.getPathKey(pathItem));
        return node!.path_item_key;
      });

      const startTime = new Date(timetableItem.start_time);
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
        const sourceScheduleEntry = timetableItem.schedule!.find(
          (entry) => entry.at === timetableItem.path[i].id
        );
        const targetScheduleEntry = timetableItem.schedule!.find(
          (entry) => entry.at === timetableItem.path[i + 1].id
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
          trainrunId: index + 1,
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
    }
  );

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
 * Return a compatible object for NGE.
 */
export const getNgeDto = (state: MacroEditorState): NetzgrafikDto => {
  const labels = getNgeLabels(state);
  return {
    ...getNgeTrainrunSectionsWithNodes(state, labels),
    trainruns: getNgeTrainruns(state, labels),
    resources: [state.ngeResource],
    metadata: {
      netzgrafikColors: [],
      trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
      trainrunFrequencies: state.trainrunFrequencies,
      trainrunTimeCategories: DEFAULT_TRAINRUN_TIME_CATEGORIES,
    },
    freeFloatingTexts: [],
    labels,
    labelGroups: [NODE_LABEL_GROUP, TRAINRUN_LABEL_GROUP],
    filterData: {
      filterSettings: [],
    },
  };
};
