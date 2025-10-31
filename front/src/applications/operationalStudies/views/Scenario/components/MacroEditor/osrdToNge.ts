import type { TFunction } from 'i18next';
import { uniqBy } from 'lodash';

import type { TimetableItemRoundTripGroups } from 'applications/operationalStudies/types';
import {
  getUniqueOpRefsFromTimetableItems,
  addPathOpsToTimetableItems,
  groupRoundTrips,
  checkRoundTripCompatible,
} from 'applications/operationalStudies/utils';
import {
  osrdEditoastApi,
  type SubCategory,
  type TrainSchedule,
  type MacroNoteResponse,
} from 'common/api/osrdEditoastApi';
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
  NOTE_LABEL_GROUP,
  DEFAULT_TIME_LOCK,
  DEFAULT_TRAINRUN_TIME_CATEGORIES,
  OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING,
} from './consts';
import MacroEditorState, { type NodeIndexed } from './MacroEditorState';
import {
  getDefaultTrainrunFrequencies,
  getNetzgrafikColors,
  getTrainrunCategoryId,
  getTrainrunFrequencyFromTimetableItem,
  getTrainrunTimeCategoryFromFrequency,
} from './utils';
import {
  type PortDto,
  type TimeLockDto,
  type TrainrunDto,
  type TrainrunSectionDto,
  type TrainrunFrequency,
  type NetzgrafikDto,
  PortAlignment,
  type LabelDto,
  type TrainrunCategory,
  type FreeFloatingTextDto,
} from '../NGE/types';

type ScheduleItem = NonNullable<TrainSchedule['schedule']>[number];

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

export const getTrainrunCategories = (
  t: TFunction<'operational-studies'>,
  subCategories: SubCategory[]
): TrainrunCategory[] => {
  const subCategoriesFormatted = subCategories.map((subCat, i) => ({
    id: OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING.size + i + 1,
    order: OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING.size + i + 1,
    name: subCat.name,
    shortName: subCat.code,
    fachCategory: 'HaltezeitUncategorized',
    colorRef: 'sub_' + subCat.code,
    minimalTurnaroundTime: 0,
    nodeHeadwayStop: 0,
    nodeHeadwayNonStop: 0,
    sectionHeadway: 0,
  }));

  const mainCategoriesFormatted = Array.from(
    OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING.entries()
  ).map(([key, category]) => ({
    ...category,
    name: t(`main.macroEditor.trainCategory.${key}.name`),
    shortName: t(`main.macroEditor.trainCategory.${key}.shortName`),
  }));

  return [...mainCategoriesFormatted, ...subCategoriesFormatted];
};

/**
 * Load & index the data of the timetableItem for the given scenario.
 */
export const loadAndIndexNge = async (
  state: MacroEditorState,
  timetableItems: TimetableItemWithPathOps[],
  dispatch: AppDispatch,
  t: TFunction<'operational-studies'>,
  subCategories: SubCategory[],
  notes: MacroNoteResponse[]
): Promise<void> => {
  notes.forEach((note) => {
    state.setDbIdForNote(note.id, note.id);
    note.labels.forEach((label) => state.noteLabels.add(label));
  });

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
          trigram: 'trigram' in pathItem ? pathItem.trigram : null,
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
  const savedNodes = await dispatch(
    osrdEditoastApi.endpoints.getAllMacroNodes.initiate(
      {
        projectId: state.projectId,
        studyId: state.studyId,
        scenarioId: state.scenarioId,
      },
      { subscribe: false }
    )
  ).unwrap();
  await Promise.all(
    savedNodes.map(async (n) => {
      if (state.getNodeByKey(n.path_item_key) !== null) {
        state.updateNodeDataByKey(n.path_item_key, { ...n, dbId: n.id });
      } else {
        state.indexNodeByKey(n.path_item_key, { ...n, dbId: n.id, ngeId: nbNodesIndexed });
        nbNodesIndexed += 1;
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
  state.trainrunCategories = getTrainrunCategories(t, subCategories);

  // Now that we have all nodes, we apply a layout
  applyLayout(state, timetableItems);
};

/**
 * Translate the TimetableItems of OSRD into NGE Trainruns.
 */
const getNgeTrainruns = (
  state: MacroEditorState,
  groupedTimetableItems: (readonly [TimetableItem, TimetableItem | null])[],
  labels: LabelDto[]
): TrainrunDto[] =>
  groupedTimetableItems
    .map(([a, b]) => ({ ...a, returnId: b?.id ?? null }))
    .filter((timetableItem) => timetableItem.path.length >= 2)
    .map((timetableItem, index) => {
      state.timetableItemIdByNgeId.set(index + 1, [timetableItem.id, timetableItem.returnId]);
      const trainrunFrequency = getTrainrunFrequencyFromTimetableItem(timetableItem, state);

      return {
        id: index + 1,
        name: timetableItem.train_name,
        categoryId: getTrainrunCategoryId(state.trainrunCategories, timetableItem.category),
        frequencyId: trainrunFrequency.id,
        trainrunTimeCategoryId: getTrainrunTimeCategoryFromFrequency(trainrunFrequency).id,
        labelIds: (timetableItem.labels || []).map((l) =>
          labels.findIndex((e) => e.label === l && e.labelGroupId === TRAINRUN_LABEL_GROUP.id)
        ),
        direction: timetableItem.returnId ? 'round_trip' : 'one_way',
      };
    });

const createTimeLock = (time: Date, startTime: Date): TimeLockDto => ({
  time: time.getMinutes(),
  // getTime() is in milliseconds, consecutiveTime is in minutes
  consecutiveTime: (time.getTime() - startTime.getTime()) / (60 * 1000),
  lock: false,
  warning: null,
  timeFormatter: null,
});

const createArrivalTimeLock = (scheduleItem: ScheduleItem | undefined, startTime: Date) => {
  if (!scheduleItem?.arrival) {
    return { ...DEFAULT_TIME_LOCK };
  }
  const arrival = Duration.parse(scheduleItem.arrival);
  return createTimeLock(addDurationToDate(startTime, arrival), startTime);
};

const createDepartureTimeLock = (scheduleItem: ScheduleItem | undefined, startTime: Date) => {
  if (!scheduleItem?.arrival) {
    return { ...DEFAULT_TIME_LOCK };
  }
  const arrival = Duration.parse(scheduleItem.arrival);
  const stopFor = scheduleItem.stop_for ? Duration.parse(scheduleItem.stop_for) : Duration.zero;
  return createTimeLock(
    addDurationToDate(addDurationToDate(startTime, arrival), stopFor),
    startTime
  );
};

/**
 * Translate the TimetableItem in NGE "TrainrunSection" & "Nodes".
 * It is needed to return the nodes as well, because we add ports & transitions on them.
 */
const getNgeTrainrunSectionsWithNodes = (
  state: MacroEditorState,
  groupedTimetableItems: (readonly [TimetableItem, TimetableItem | null])[],
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
  for (const node of state.nodes) {
    if (!node) continue;
    ngeNodesByPathKey[node.path_item_key] = castNodeToNge(state, node, labels);
  }

  let trainrunSectionId = 0;
  const trainrunSections: TrainrunSectionDto[] = groupedTimetableItems.flatMap(
    ([timetableItem, returnTimetableItem], index) => {
      // Figure out the primary node key for each path item
      const pathNodeKeys = timetableItem.path.map((pathItem) => {
        const node = state.getNodeByKey(MacroEditorState.getPathKey(pathItem));
        return node!.path_item_key;
      });

      const startTime = new Date(timetableItem.start_time);
      const returnStartTime = returnTimetableItem ? new Date(returnTimetableItem.start_time) : null;

      // OSRD describes the path in terms of nodes, NGE describes it in terms
      // of sections between nodes. Iterate over path items two-by-two to
      // convert them.
      let prevPort: PortDto | null = null;
      return pathNodeKeys.slice(0, -1).map((sourceNodeKey, i) => {
        // returnTimetableItem contains the same path as timetableItem but in
        // reverse order. `timetableItem.path.length - 1` is the index of the
        // last path item, subtracting `i` will iterate from the end of the
        // list to the start.
        const returnIndex = timetableItem.path.length - 1 - i;

        const sourceNode = ngeNodesByPathKey[sourceNodeKey];
        const targetNodeKey = pathNodeKeys[i + 1];
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
        const returnSourceScheduleEntry = returnTimetableItem?.schedule?.find(
          (entry) => entry.at === returnTimetableItem.path[returnIndex].id
        );
        const returnTargetScheduleEntry = returnTimetableItem?.schedule?.find(
          (entry) => entry.at === returnTimetableItem.path[returnIndex - 1].id
        );

        // Create a transition between the previous section and the one we're creating
        if (prevPort) {
          const transition = createTransition(prevPort.id, sourcePort.id);
          transition.isNonStopTransit = !sourceScheduleEntry?.stop_for;
          sourceNode.transitions.push(transition);
        }
        prevPort = targetPort;

        let sourceDeparture;
        if (i === 0) {
          sourceDeparture = createTimeLock(startTime, startTime);
        } else {
          sourceDeparture = createDepartureTimeLock(sourceScheduleEntry, startTime);
        }

        const targetArrival = createArrivalTimeLock(targetScheduleEntry, startTime);

        let targetDeparture = { ...DEFAULT_TIME_LOCK };
        if (returnStartTime) {
          if (returnIndex === 1) {
            targetDeparture = createTimeLock(returnStartTime, returnStartTime);
          } else {
            targetDeparture = createDepartureTimeLock(returnTargetScheduleEntry, returnStartTime);
          }
        } else if (returnIndex === 1) {
          targetDeparture = createTimeLock(startTime, startTime);
        }

        let sourceArrival = { ...DEFAULT_TIME_LOCK };
        if (returnStartTime) {
          sourceArrival = createArrivalTimeLock(returnSourceScheduleEntry, returnStartTime);
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
          sourceArrival,
          targetDeparture,
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
    ...Array.from(state.noteLabels).map((l) => ({
      label: l,
      labelGroupId: NOTE_LABEL_GROUP.id,
      labelRef: 'Note',
    })),
  ].map((l, i) => ({ ...l, id: i }));

const getNoteLabelIds = (labelTexts: string[], state: MacroEditorState): number[] => {
  const labels = getNgeLabels(state);
  return labelTexts
    .map((text) => labels.find((label) => label.label === text)?.id)
    .filter((id): id is number => id !== undefined);
};

/**
 * Return a compatible object for NGE.
 */
export const getNgeDto = (
  state: MacroEditorState,
  groupedTimetableItems: (readonly [TimetableItem, TimetableItem | null])[],
  subCategories: SubCategory[],
  notes: MacroNoteResponse[]
): NetzgrafikDto => {
  const labels = getNgeLabels(state);

  const freeFloatingTexts: FreeFloatingTextDto[] = notes.map((note) => ({
    id: note.id,
    x: note.x,
    y: note.y,
    width: 200,
    height: 100,
    title: note.title,
    text: note.text,
    backgroundColor: '#ffffff',
    textColor: '#000000',
    labelIds: getNoteLabelIds(note.labels, state),
  }));

  return {
    ...getNgeTrainrunSectionsWithNodes(state, groupedTimetableItems, labels),
    trainruns: getNgeTrainruns(state, groupedTimetableItems, labels),
    resources: [state.ngeResource],
    metadata: {
      netzgrafikColors: getNetzgrafikColors(subCategories),
      trainrunCategories: state.trainrunCategories,
      trainrunFrequencies: state.trainrunFrequencies,
      trainrunTimeCategories: DEFAULT_TRAINRUN_TIME_CATEGORIES,
    },
    freeFloatingTexts,
    labels,
    labelGroups: [NODE_LABEL_GROUP, TRAINRUN_LABEL_GROUP, NOTE_LABEL_GROUP],
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

const groupCompatibleRoundTrips = (
  roundTripGroups: TimetableItemRoundTripGroups
): (readonly [TimetableItemWithPathOps, TimetableItemWithPathOps | null])[] => {
  const incompatible = [];
  const compatible = [];
  for (const [a, b] of roundTripGroups.roundTrips) {
    if (checkRoundTripCompatible(a, b)) {
      compatible.push([a, b] as const);
    } else {
      incompatible.push(a, b);
    }
  }
  const oneWays = [...roundTripGroups.oneWays, ...roundTripGroups.others, ...incompatible].map(
    (timetableItem) => [timetableItem, null] as const
  );
  return [...oneWays, ...compatible];
};

export const loadNgeDto = async (
  state: MacroEditorState,
  timetableId: number,
  dispatch: AppDispatch,
  t: TFunction<'operational-studies'>
): Promise<NetzgrafikDto> => {
  const notesResult = await dispatch(
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotes.initiate(
      {
        projectId: state.projectId,
        studyId: state.studyId,
        scenarioId: state.scenarioId,
      },
      { subscribe: false }
    )
  ).unwrap();

  const notes = notesResult.results;

  const trainSchedulesPromise = dispatch(
    osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate(
      { timetableId },
      { subscribe: false }
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
      { subscribe: false }
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

  const timetableItemsById = new Map(
    timetableItems.map((timetableItem) => [timetableItem.id, timetableItem])
  );

  const trainScheduleRoundTripsPromise = dispatch(
    osrdEditoastApi.endpoints.getTimetableByIdRoundTripsTrainSchedules.initiate(
      { id: timetableId },
      { subscribe: false }
    )
  );
  const pacedTrainRoundTripsPromise = dispatch(
    osrdEditoastApi.endpoints.getTimetableByIdRoundTripsPacedTrains.initiate(
      { id: timetableId },
      { subscribe: false }
    )
  );
  const { results: trainScheduleRoundTrips } = await trainScheduleRoundTripsPromise.unwrap();
  const { results: pacedTrainRoundTrips } = await pacedTrainRoundTripsPromise.unwrap();
  const roundTripGroups = groupRoundTrips(timetableItemsById, {
    trainSchedules: trainScheduleRoundTrips,
    pacedTrains: pacedTrainRoundTrips,
  });
  const groupedTimetableItems = groupCompatibleRoundTrips(roundTripGroups);

  const { results: subCategories } = await dispatch(
    osrdEditoastApi.endpoints.getSubCategory.initiate({ page: 1 }, { subscribe: false })
  ).unwrap();

  await loadAndIndexNge(state, timetableItems, dispatch, t, subCategories, notes);
  return await getNgeDto(state, groupedTimetableItems, subCategories, notes);
};
