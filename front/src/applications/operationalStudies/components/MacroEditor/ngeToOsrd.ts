import { compact, uniq } from 'lodash';

import {
  osrdEditoastApi,
  type PacedTrainBase,
  type SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import type {
  PacedTrainResultWithPacedTrainId,
  TimetableItemId,
  TimetableItemWithTimetableId,
} from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { Duration } from 'utils/duration';
import {
  formatEditoastTrainIdToPacedTrainId,
  formatPacedTrainIdToEditoastTrainId,
  formatTrainScheduleIdToEditoastTrainId,
  isPacedTrain,
} from 'utils/trainId';

import type MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';
import { createMacroNode, deleteMacroNodeByNgeId, updateMacroNode } from './utils';
import type {
  NetzgrafikDto,
  NGEEvent,
  TrainrunSectionDto,
  NodeDto,
  TimeLockDto,
  TrainrunDto,
  LabelDto,
} from '../NGE/types';

const getNodeById = (nodes: NodeDto[], nodeId: number | string) =>
  nodes.find((node) => node.id === nodeId);

const getTrainrunSectionsByTrainrunId = (netzgrafikDto: NetzgrafikDto, trainrunId: number) => {
  // The sections we obtain here may be out-of-order. For instance, for a path
  // A → B → C, we may get two sections B → C and then A → B. We need to
  // re-order the section A → B before B → C.
  const sections = netzgrafikDto.trainrunSections.filter(
    (section) => section.trainrunId === trainrunId
  );

  // Sections are linked together with transitions and ports:
  //
  //                           Node
  //                 ┌──────────────────────┐
  //                 │                      │
  //      Section  ┌─┴──┐   Transition   ┌──┴─┐  Section
  //     ──────────┤Port├────────────────┤Port├──────────
  //               └─┬──┘                └──┬─┘
  //                 │                      │
  //                 └──────────────────────┘
  //
  //
  // Two subsequent sections can be linked together at a node with a target
  // port followed by a transition itself followed by a source port.
  //
  // Build a map of sections keyed by their previous section's target port ID.
  // Find the departure section: it's the one without a transition for its
  // source port.
  let departureSection: TrainrunSectionDto | undefined;
  const sectionsByPrevTargetPortId = new Map<number, TrainrunSectionDto>();
  for (const section of sections) {
    const sourceNode = getNodeById(netzgrafikDto.nodes, section.sourceNodeId)!;
    const transition = sourceNode.transitions.find(
      (tr) => tr.port1Id === section.sourcePortId || tr.port2Id === section.sourcePortId
    );
    if (transition) {
      const prevPortId =
        transition.port1Id === section.sourcePortId ? transition.port2Id : transition.port1Id;
      sectionsByPrevTargetPortId.set(prevPortId, section);
    } else {
      departureSection = section;
    }
  }
  if (!departureSection) {
    throw new Error('Train run is missing departure section');
  }

  // Start with the departure section and iterate over the path
  const orderedSections = [departureSection];
  const seenSectionIds = new Set<number>([departureSection.id]);
  let section: TrainrunSectionDto | undefined = departureSection;
  for (;;) {
    section = sectionsByPrevTargetPortId.get(section.targetPortId);
    if (!section) {
      break;
    }

    orderedSections.push(section);

    // Make sure we don't enter an infinite loop
    if (seenSectionIds.has(section.id)) {
      throw new Error('Cycle detected in train run');
    }
    seenSectionIds.add(section.id);
  }

  // If we haven't seen all sections belonging to the train run, it's because
  // it's made up of multiple separate parts
  if (orderedSections.length !== sections.length) {
    throw new Error('Train run is not continuous');
  }

  return orderedSections;
};

const DEFAULT_PAYLOAD: Pick<PacedTrainBase, 'constraint_distribution' | 'rolling_stock_name'> = {
  constraint_distribution: 'STANDARD',
  rolling_stock_name: '',
};

const createPathItemFromNode = async (
  node: NodeDto,
  index: number,
  infraId: number,
  dispatch: AppDispatch
) => {
  const [trigram, secondaryCode] = node.betriebspunktName.split('/');
  let finalSecondaryCode: string | undefined;

  if (secondaryCode) {
    finalSecondaryCode = secondaryCode;
    return {
      trigram,
      secondary_code: finalSecondaryCode,
      id: `${node.id}-${index}`,
    };
  }

  const searchPayload = {
    object: 'operationalpoint',
    query: ['and', ['=', ['infra_id'], infraId], ['=', ['trigram'], trigram]],
  };
  const searchResults = (await dispatch(
    osrdEditoastApi.endpoints.postSearch.initiate({
      searchPayload,
    })
  ).unwrap()) as SearchResultItemOperationalPoint[];

  let opFound = searchResults.find((op) => op.ch === 'BV' || op.ch === '00');
  if (!opFound) opFound = searchResults.find((op) => op.ch === '');
  finalSecondaryCode = opFound?.ch;

  return {
    trigram,
    secondary_code: finalSecondaryCode,
    id: `${node.id}-${index}`,
  };
};

const getTimeLockDate = (
  timeLock: TimeLockDto,
  startTimeLock: TimeLockDto,
  startDate: Date
): Date | null => {
  if (timeLock.time === null) return null;
  const offset = timeLock.consecutiveTime! - startTimeLock.consecutiveTime!;
  return new Date(startDate.getTime() + offset * 60 * 1000);
};

const formatDateDifferenceFrom = (start: Date, stop: Date) =>
  Duration.subtractDate(stop, start).toISOString();

/**
 * Generate a path from a list of trainrun sections.
 */
const generatePath = async (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  infraId: number,
  dispatch: AppDispatch
) => {
  const pathPromises = trainrunSections.map(async (section, index) => {
    const sourceNode = getNodeById(nodes, section.sourceNodeId);
    const targetNode = getNodeById(nodes, section.targetNodeId);
    if (!sourceNode || !targetNode) return [];
    const originPathItem = await createPathItemFromNode(sourceNode, index, infraId, dispatch);
    if (index === trainrunSections.length - 1) {
      const destinationPathItem = await createPathItemFromNode(
        targetNode,
        index + 1,
        infraId,
        dispatch
      );
      return [originPathItem, destinationPathItem];
    }
    return [originPathItem];
  });

  return (await Promise.all(pathPromises)).flat();
};

/**
 * Extract the labels of a trainrun.
 */
const extractTrainrunLabels = (trainrun: TrainrunDto, labels: LabelDto[]): string[] =>
  compact(
    uniq(trainrun.labelIds.map((labelId) => labels.find((label) => label.id === labelId)?.label))
  );

/**
 * Calculate the start date of a trainrun.
 */
const calculateStartDate = (trainrunSections: TrainrunSectionDto[], oldStartDate: Date): Date => {
  // The departure time of the first section is guaranteed to be non-null
  const startTimeLock = trainrunSections[0].sourceDeparture;
  const startDate = new Date(oldStartDate);
  startDate.setMinutes(startTimeLock.time!, 0, 0);
  return startDate;
};

/**
 * Generate a schedule (list of stops with their arrival and departure times)
 * from a list of trainrun sections.
 */
const generateSchedule = (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  startDate: Date
) =>
  trainrunSections.flatMap((section, index) => {
    const nextSection = trainrunSections[index + 1];
    const node = getNodeById(nodes, section.targetNodeId)!;
    const transition = node.transitions.find(
      (tr) => tr.port1Id === section.targetPortId || tr.port2Id === section.targetPortId
    );
    const isNonStopTransit = transition?.isNonStopTransit ?? false;

    // Note that arrival is the time the train arrives at the node
    // and departure is the time the train leaves the node
    let arrival = getTimeLockDate(
      section.targetArrival,
      trainrunSections[0].sourceDeparture,
      startDate
    );
    const departure = nextSection
      ? getTimeLockDate(nextSection.sourceDeparture, trainrunSections[0].sourceDeparture, startDate)
      : null;

    if (!arrival && !departure) return [];

    // If missing arrival time, default to a zero stop duration
    arrival = arrival || departure!;

    return {
      at: `${section.targetNodeId}-${index + 1}`,
      arrival: formatDateDifferenceFrom(startDate, arrival),
      stop_for:
        departure && !isNonStopTransit ? formatDateDifferenceFrom(arrival, departure) : null,
    };
  });

/**
 * Create a TimetableItem payload from a trainrun.
 */
const generateTimetableItemPayload = async ({
  trainrunSections,
  nodes,
  trainrun,
  infraId,
  dispatch,
  labels,
  oldStartDate,
}: {
  trainrunSections: TrainrunSectionDto[];
  nodes: NodeDto[];
  trainrun: TrainrunDto;
  infraId: number;
  dispatch: AppDispatch;
  labels: LabelDto[];
  oldStartDate: Date;
}) => {
  const path = await generatePath(trainrunSections, nodes, infraId, dispatch);
  const trainrunLabels = extractTrainrunLabels(trainrun, labels);
  const startDate = calculateStartDate(trainrunSections, oldStartDate);
  const schedule = generateSchedule(trainrunSections, nodes, startDate);

  return {
    train_name: trainrun.name,
    labels: trainrunLabels,
    path,
    start_time: startDate.toISOString(),
    schedule,
    paced: {
      duration: new Duration({ hours: 2 }).toISOString(),
      step: new Duration({ minutes: 60 }).toISOString(),
    },
  };
};

const fetchTimetableItem = async (
  timetableItemId: TimetableItemId,
  dispatch: AppDispatch
): Promise<TimetableItemWithTimetableId> => {
  if (isPacedTrain(timetableItemId)) {
    const pacedTrain = await dispatch(
      osrdEditoastApi.endpoints.getPacedTrainById.initiate({
        id: formatPacedTrainIdToEditoastTrainId(timetableItemId),
      })
    ).unwrap();
    return { ...pacedTrain, id: timetableItemId };
  }
  const trainSchedule = await dispatch(
    osrdEditoastApi.endpoints.getTrainScheduleById.initiate({
      id: formatTrainScheduleIdToEditoastTrainId(timetableItemId),
    })
  ).unwrap();
  return { ...trainSchedule, id: timetableItemId };
};

const createPacedTrain = async (
  timetableId: number,
  pacedTrain: PacedTrainBase,
  dispatch: AppDispatch
): Promise<PacedTrainResultWithPacedTrainId> => {
  const newTimetableItems = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
      id: timetableId,
      body: [pacedTrain],
    })
  ).unwrap();
  if (!newTimetableItems || newTimetableItems.length === 0) {
    throw new Error('Failed to create paced train');
  }
  return {
    ...newTimetableItems[0],
    id: formatEditoastTrainIdToPacedTrainId(newTimetableItems[0].id),
  };
};

const updateTimetableItem = async (
  timetableItemId: TimetableItemId,
  timetableItem: TimetableItemWithTimetableId,
  dispatch: AppDispatch
) => {
  if (isPacedTrain(timetableItemId)) {
    const newTimetableItem = await dispatch(
      osrdEditoastApi.endpoints.putPacedTrainById.initiate({
        id: formatPacedTrainIdToEditoastTrainId(timetableItemId),
        pacedTrainForm: {
          ...timetableItem,
          // Reset margins because they contain references to path items
          margins: undefined,
        },
      })
    ).unwrap();
    return newTimetableItem;
  }
  return;
};

const handleCreateTimetableItem = async (
  timetableId: number,
  netzgrafikDto: NetzgrafikDto,
  trainrun: TrainrunDto,
  infraId: number,
  dispatch: AppDispatch,
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void,
  state: MacroEditorState
): Promise<void> => {
  const timetableItemPayload = await generateTimetableItemPayload({
    trainrunSections: getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id),
    nodes: netzgrafikDto.nodes,
    trainrun,
    infraId,
    dispatch,
    labels: netzgrafikDto.labels,
    oldStartDate: new Date(),
  });
  const newPacedTrain = await createPacedTrain(
    timetableId,
    { ...DEFAULT_PAYLOAD, ...timetableItemPayload } as PacedTrainBase,
    dispatch
  );
  state.trainIdByNgeId.set(trainrun.id, newPacedTrain.id);
  addUpsertedTimetableItems([newPacedTrain]);
};

const handleUpdateTimetableItem = async ({
  netzgrafikDto,
  trainrun,
  dispatch,
  infraId,
  addUpsertedTimetableItems,
  state,
}: {
  netzgrafikDto: NetzgrafikDto;
  trainrun: TrainrunDto;
  dispatch: AppDispatch;
  infraId: number;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  state: MacroEditorState;
}): Promise<void> => {
  const timetableItemId: TimetableItemId = state.trainIdByNgeId.get(trainrun.id)!;
  const timetableItem = await fetchTimetableItem(timetableItemId, dispatch);
  const timetableItemPayload = await generateTimetableItemPayload({
    trainrunSections: getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id),
    nodes: netzgrafikDto.nodes,
    trainrun,
    infraId,
    dispatch,
    labels: netzgrafikDto.labels,
    oldStartDate: new Date(timetableItem.start_time),
  });
  const updatedTimetableItem = await updateTimetableItem(
    timetableItemId,
    { ...timetableItem, ...timetableItemPayload },
    dispatch
  );
  addUpsertedTimetableItems([updatedTimetableItem]);
};

const handleDeleteTimetableItem = async (
  trainrunId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void
): Promise<void> => {
  const timetableItemId: TimetableItemId = state.trainIdByNgeId.get(trainrunId)!;
  const editoastTrainId: number = isPacedTrain(timetableItemId)
    ? formatPacedTrainIdToEditoastTrainId(timetableItemId)
    : formatTrainScheduleIdToEditoastTrainId(timetableItemId);
  const endpoint = isPacedTrain(timetableItemId)
    ? osrdEditoastApi.endpoints.deletePacedTrain
    : osrdEditoastApi.endpoints.deleteTrainSchedule;
  await dispatch(
    endpoint.initiate({
      body: { ids: [editoastTrainId] },
    })
  ).unwrap();
  addDeletedTimetableItemIds([timetableItemId]);
  state.trainIdByNgeId.delete(trainrunId);
};

const handleTrainrunOperation = async ({
  type,
  trainrunId,
  dispatch,
  infraId,
  timetableId,
  netzgrafikDto,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
  state,
}: {
  type: NGEEvent['type'];
  trainrunId: number;
  dispatch: AppDispatch;
  infraId: number;
  timetableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
  state: MacroEditorState;
}): Promise<void> => {
  const trainrun = netzgrafikDto.trainruns.find((tr) => tr.id === trainrunId);
  switch (type) {
    case 'create': {
      await handleCreateTimetableItem(
        timetableId,
        netzgrafikDto,
        trainrun!,
        infraId,
        dispatch,
        addUpsertedTimetableItems,
        state
      );
      break;
    }
    case 'update': {
      // await handleUpdateTimetableItem({
      //   netzgrafikDto,
      //   trainrun: trainrun!,
      //   dispatch,
      //   infraId,
      //   addUpsertedTimetableItems,
      //   state,
      // });
      break;
    }
    case 'delete': {
      await handleDeleteTimetableItem(trainrunId, state, dispatch, addDeletedTimetableItemIds);
      break;
    }
    default:
      break;
  }
};

/**
 * Cast a NGE node to a node.
 */
const castNgeNode = (
  node: NetzgrafikDto['nodes'][0],
  labels: NetzgrafikDto['labels']
): Omit<NodeIndexed, 'path_item_key' | 'dbId'> => ({
  ngeId: node.id,
  trigram: node.betriebspunktName,
  full_name: node.fullName,
  connection_time: node.connectionTime,
  position_x: node.positionX,
  position_y: node.positionY,
  labels: node.labelIds
    .map((id) => {
      const ngeLabel = labels.find((e) => e.id === id);
      if (ngeLabel) return ngeLabel.label;
      return null;
    })
    .filter((n) => n !== null),
});

const handleNodeOperation = async ({
  state,
  type,
  node,
  netzgrafikDto,
  dispatch,
}: {
  state: MacroEditorState;
  type: NGEEvent['type'];
  node: NodeDto;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
}): Promise<void> => {
  const indexNode = state.getNodeByNgeId(node.id);
  switch (type) {
    case 'create':
    case 'update': {
      if (indexNode) {
        if (indexNode.dbId) {
          // Update the key if trigram has changed and key is based on it
          let nodeKey = indexNode.path_item_key;
          if (nodeKey.startsWith('trigram:') && indexNode.trigram !== node.betriebspunktName) {
            nodeKey = `trigram:${node.betriebspunktName}`;
          }
          await updateMacroNode(state, dispatch, {
            ...indexNode,
            ...castNgeNode(node, netzgrafikDto.labels),
            dbId: indexNode.dbId,
            path_item_key: nodeKey,
          });
        } else {
          const newNode = {
            ...indexNode,
            ...castNgeNode(node, netzgrafikDto.labels),
          };
          // Create the node
          await createMacroNode(state, dispatch, newNode, node.id);
        }
      } else {
        // It's an unknown node, we need to create it in the db
        // We assume that `betriebspunktName` is a trigram
        const key = `trigram:${node.betriebspunktName}`;
        // Create the node
        await createMacroNode(
          state,
          dispatch,
          {
            ...castNgeNode(node, netzgrafikDto.labels),
            path_item_key: key,
          },
          node.id
        );
      }
      break;
    }
    case 'delete': {
      if (indexNode) await deleteMacroNodeByNgeId(state, dispatch, node.id);
      break;
    }
    default:
      break;
  }
};

const handleLabelOperation = async ({
  type,
  label,
  netzgrafikDto,
  dispatch,
  infraId,
  addUpsertedTimetableItems,
  state,
}: {
  type: NGEEvent['type'];
  label: LabelDto;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
  infraId: number;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  state: MacroEditorState;
}): Promise<void> => {
  const { trainruns } = netzgrafikDto;
  switch (type) {
    case 'update': {
      const trainrunUpdateLabels = trainruns.filter((trainrun) =>
        trainrun.labelIds.includes(label.id)
      );
      trainrunUpdateLabels.forEach(async (trainrun) => {
        await handleUpdateTimetableItem({
          netzgrafikDto,
          trainrun,
          dispatch,
          infraId,
          addUpsertedTimetableItems,
          state,
        });
      });
      break;
    }
    default: {
      break;
    }
  }
};

const handleOperation = async ({
  event,
  dispatch,
  state,
  infraId,
  timetableId,
  netzgrafikDto,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  event: NGEEvent;
  dispatch: AppDispatch;
  state: MacroEditorState;
  infraId: number;
  timetableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  addDeletedTimetableItemIds: (timetableItemsIds: TimetableItemId[]) => void;
}) => {
  const { type } = event;
  switch (event.objectType) {
    case 'node':
      await handleNodeOperation({ state, dispatch, netzgrafikDto, type, node: event.node });
      break;
    case 'trainrun': {
      await handleTrainrunOperation({
        type,
        trainrunId: event.trainrun.id,
        dispatch,
        infraId,
        timetableId,
        netzgrafikDto,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds,
        state,
      });
      break;
    }
    case 'label':
      await handleLabelOperation({
        type,
        label: event.label,
        netzgrafikDto,
        dispatch,
        infraId,
        addUpsertedTimetableItems,
        state,
      });
      break;
    default:
      break;
  }
};

export default handleOperation;
