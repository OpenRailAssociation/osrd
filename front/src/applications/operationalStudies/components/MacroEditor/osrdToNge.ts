import type { TFunction } from 'i18next';
import { uniqBy } from 'lodash';

import {
  getUniqueOpRefsFromTimetableItems,
  addPathOpsToTimetableItems,
} from 'applications/operationalStudies/utils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItem, TimetableItemWithPathOps } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { Duration, addDurationToDate } from 'utils/duration';
import {
  isPacedTrainResponseWithPacedTrainId,
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
} from 'utils/trainId';

import {
  TRAINRUN_CATEGORY_HALTEZEITEN,
  NODE_LABEL_GROUP,
  TRAINRUN_LABEL_GROUP,
  DEFAULT_TIME_LOCK,
  DEFAULT_TRAINRUN_TIME_CATEGORIES,
  OSRD_TRAINRUN_CATEGORY_MAPPING,
} from './consts';
import MacroEditorState, { type NodeIndexed } from './MacroEditorState';
import {
  deleteMacroNodeByDbId,
  getDefaultTrainrunFrequencies,
  getNetzgrafikColors,
  getSavedMacroNodes,
  getTrainrunCategoryId,
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
  type TrainrunCategory,
} from '../NGE/types';

/**
 * Get the TrainrunFrequencies from the TimetableItems.
 * We need to add the unknown frequencies from the PacedTrains.
 */
const getNgeTrainrunFrequencies = (
  timetableItems: TimetableItem[],
  t: TFunction<'operational-studies'>
): TrainrunFrequency[] => {
  // Get the default frequencies (TrainSchedule/30min/60min/120min)
  const trainrunFrequencies = getDefaultTrainrunFrequencies(t);

  // Add the unknown frequencies from the PacedTrains
  timetableItems.forEach((timetableItem) => {
    if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
      const intervalInMinutes = Duration.parse(timetableItem.paced.interval).total('minute');
      if (!trainrunFrequencies.find((f) => f.frequency === intervalInMinutes)) {
        const newFrequency: TrainrunFrequency = {
          id: trainrunFrequencies.length + 1,
          order: 0, // temporary order
          frequency: intervalInMinutes,
          offset: 0,
          name: t('main.macroEditor.intervalXmin', { minutes: intervalInMinutes }),
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

const distance = (a: [number, number], b: [number, number]): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
};

type PositionedNodeIndexed = { nodeData: NodeIndexed; x: number; y: number };

const avoidNodesOverlaps = (
  nodes: PositionedNodeIndexed[],
  // How close is too close?
  minDistance: number,
  // How much to push nodes away from each other?
  pushFactor: number
): PositionedNodeIndexed[] => {
  // Compute the center of the nodes.
  const xs = nodes.map((m) => m.x);
  const ys = nodes.map((m) => m.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Sort nodes by distance to the center.
  nodes.sort((a, b) => {
    const dA = distance([a.x, a.y], [centerX, centerY]);
    const dB = distance([b.x, b.y], [centerX, centerY]);
    return dA - dB;
  });

  const result: PositionedNodeIndexed[] = [];
  for (const node of nodes) {
    const { nodeData, x: positionX, y: positionY } = node;
    let newX = positionX;
    let newY = positionY;
    const centerToNewNorm = distance([centerX, centerY], [newX, newY]);
    const centerToNewX = newX - centerX;
    const centerToNewY = newY - centerY;
    const normalizedCenterToNewX = centerToNewNorm ? centerToNewX / centerToNewNorm : 0;
    const normalizedCenterToNewY = centerToNewNorm ? centerToNewY / centerToNewNorm : 0;

    // Check for overlaps with already placed nodes.
    // TODO: ideally, we should also consider fixed nodes
    // TODO: that order is somewhat flawed, we should use a
    // more efficient data structure to repeatedly check for close neighbors
    for (const placedNode of result) {
      const { x: placedX, y: placedY } = placedNode;
      const d = distance([newX, newY], [placedX, placedY]);

      // If the distance is too small, move the node away.
      // TODO: ideally this would compute actual overlaps, depending on the node size,
      // not just distances
      if (d < minDistance) {
        newX += minDistance * pushFactor * normalizedCenterToNewX;
        newY += minDistance * pushFactor * normalizedCenterToNewY;
      }
    }
    result.push({
      nodeData,
      x: Math.round(newX),
      y: Math.round(newY),
    });
  }
  return result;
};

/**
 * Apply a layout on nodes and save the new position.
 * Nodes that are saved are fixed.
 */
const applyLayout = (state: MacroEditorState, timetableItems: TimetableItem[]) => {
  const indexedNodes = uniqBy(
    timetableItems.flatMap((timetableItem) => timetableItem.path),
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

  // Default positions: based on long/lat.
  const nodes: PositionedNodeIndexed[] = [];
  for (const n of indexedNodes) {
    if (!n.dbId) {
      if (n.geocoord === undefined) {
        nodes.push({ nodeData: n, x: n.position_x, y: n.position_y });
        continue;
      }
      const normalizedX = (n.geocoord.lng - minX) / (width || 1);
      const normalizedY = 1 - (n.geocoord.lat - minY) / (height || 1);
      const paddedX = normalizedX * (1 - 2 * padding) + padding;
      const paddedY = normalizedY * (1 - 2 * padding) + padding;
      const positionX = Math.round(scaleX * paddedX);
      const positionY = Math.round(scaleY * paddedY);
      nodes.push({ nodeData: n, x: positionX, y: positionY });
    }
  }

  // Avoid overlaps.
  // TODO: fine-tune the parameters
  const nicerNodes = avoidNodesOverlaps(nodes, 100, 2);

  // Update positions.
  for (const n of nicerNodes) {
    const { nodeData, x: positionX, y: positionY } = n;
    state.updateNodeDataByKey(nodeData.path_item_key, {
      position_x: positionX,
      position_y: positionY,
    });
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

export const getTrainrunCategories = (t: TFunction<'operational-studies'>): TrainrunCategory[] =>
  Array.from(OSRD_TRAINRUN_CATEGORY_MAPPING.entries()).map(([key, category]) => ({
    ...category,
    name: t(`main.macroEditor.trainCategory.${key}.name`),
    shortName: t(`main.macroEditor.trainCategory.${key}.shortName`),
  }));

/**
 * Load & index the data of the timetableItem for the given scenario.
 */
export const loadAndIndexNge = async (
  state: MacroEditorState,
  timetableItems: TimetableItemWithPathOps[],
  dispatch: AppDispatch,
  t: TFunction<'operational-studies'>
): Promise<void> => {
  // Load path items
  let nbNodesIndexed = 0;
  timetableItems
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

  const pathOps = timetableItems.flatMap((timetableItem) => timetableItem.pathOps).flat();
  for (const op of pathOps) {
    const { trigram, ch } = op.extensions?.sncf ?? {};
    for (const pathKey of MacroEditorState.getPathKeys(op)) {
      state.updateNodeDataByKey(pathKey, {
        full_name: op.extensions?.identifier?.name,
        trigram: trigram ? trigram + (ch ? `/${ch}` : '') : null,
        geocoord: op.geo ? { lng: op.geo.coordinates[0], lat: op.geo.coordinates[1] } : undefined,
      });
    }
  }

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
  timetableItems.forEach((timetableItem) => {
    timetableItem.labels?.forEach((l) => {
      state.trainrunLabels.add(l);
    });
  });

  // Initialize TrainrunFrequencies
  state.trainrunFrequencies = getNgeTrainrunFrequencies(timetableItems, t);

  // Initialize TrainrunCategories
  state.trainrunCategories = getTrainrunCategories(t);

  // Now that we have all nodes, we apply a layout
  applyLayout(state, timetableItems);
};

/**
 * Translate the TimetableItems of OSRD into NGE Trainruns.
 */
const getNgeTrainruns = (
  state: MacroEditorState,
  timetableItems: TimetableItem[],
  labels: LabelDto[]
) =>
  timetableItems
    .filter((timetableItem) => timetableItem.path.length >= 2)
    .map((timetableItem, index) => {
      state.timetableItemIdByNgeId.set(index + 1, [timetableItem.id, null]);
      const trainrunFrequency = getTrainrunFrequencyFromTimetableItem(timetableItem, state);
      return {
        id: index + 1,
        name: timetableItem.train_name,
        categoryId: getTrainrunCategoryId(timetableItem.category),
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
const getNgeTrainrunSectionsWithNodes = (
  state: MacroEditorState,
  timetableItems: TimetableItem[],
  labels: LabelDto[]
) => {
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
  const trainrunSections: TrainrunSectionDto[] = timetableItems.flatMap((timetableItem, index) => {
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
  });

  return {
    trainrunSections,
    nodes: Object.values(ngeNodesByPathKey),
  };
};

const getNgeLabels = (state: MacroEditorState): LabelDto[] =>
  [
    ...Array.from(state.nodeLabels).map((l) => ({
      label: l,
      labelGroupId: NODE_LABEL_GROUP.id,
      labelRef: 'Node',
    })),
    ...Array.from(state.trainrunLabels).map((l) => ({
      label: l,
      labelGroupId: TRAINRUN_LABEL_GROUP.id,
      labelRef: 'Trainrun',
    })),
  ].map((l, i) => ({ ...l, id: i }));

/**
 * Return a compatible object for NGE.
 */
export const getNgeDto = (
  state: MacroEditorState,
  timetableItems: TimetableItem[]
): NetzgrafikDto => {
  const labels = getNgeLabels(state);
  return {
    ...getNgeTrainrunSectionsWithNodes(state, timetableItems, labels),
    trainruns: getNgeTrainruns(state, timetableItems, labels),
    resources: [state.ngeResource],
    metadata: {
      netzgrafikColors: getNetzgrafikColors(),
      trainrunCategories: state.trainrunCategories,
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

const fetchTimetableItemPathOps = async (
  infraId: number,
  timetableItems: TimetableItem[],
  dispatch: AppDispatch
): Promise<TimetableItemWithPathOps[]> => {
  const opRefs = getUniqueOpRefsFromTimetableItems(timetableItems);
  const ops = await dispatch(
    osrdEditoastApi.endpoints.matchAllOperationalPoints.initiate(
      {
        infraId,
        opRefs,
      },
      { subscribe: false }
    )
  ).unwrap();
  return addPathOpsToTimetableItems(timetableItems, opRefs, ops);
};

export const loadNgeDto = async (
  state: MacroEditorState,
  timetableId: number,
  dispatch: AppDispatch,
  t: TFunction<'operational-studies'>
): Promise<NetzgrafikDto> => {
  const trainSchedulesPromise = dispatch(
    osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate(
      { timetableId },
      { forceRefetch: true, subscribe: false }
    )
  );
  const trainSchedules = (await trainSchedulesPromise.unwrap())
    .filter((trainSchedule) => trainSchedule.path.length >= 2)
    .map((trainSchedule) => ({
      ...trainSchedule,
      id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
    }));

  const pacedTrainsPromise = dispatch(
    osrdEditoastApi.endpoints.getAllTimetableByIdPacedTrains.initiate(
      { timetableId },
      { forceRefetch: true, subscribe: false }
    )
  );
  const pacedTrains = (await pacedTrainsPromise.unwrap())
    .filter((pacedTrain) => pacedTrain.path.length >= 2)
    .map((pacedTrain) => ({
      ...pacedTrain,
      id: formatEditoastIdToPacedTrainId(pacedTrain.id),
    }));

  const timetableItems = await fetchTimetableItemPathOps(
    state.infraId,
    [...trainSchedules, ...pacedTrains],
    dispatch
  );

  await loadAndIndexNge(state, timetableItems, dispatch, t);
  return getNgeDto(state, timetableItems);
};
