import { compact, uniq } from 'lodash';

import {
  osrdEditoastApi,
  type PacedTrain,
  type SearchResultItemOperationalPoint,
  type TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type {
  PacedTrainResponseWithPacedTrainId,
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
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

import { TRAIN_SCHEDULE_FREQUENCY_ID } from './consts';
import type MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';
import {
  createMacroNode,
  deleteMacroNodeByNgeId,
  getFrequencyFromFrequencyId,
  updateMacroNode,
} from './utils';
import {
  fetchTimetableItem,
  storePacedTrain,
  storeTrainSchedule,
} from '../../../../modules/trainschedule/components/ManageTrainSchedule/helpers/updateTimetableItemHelper';
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
    throw new Error('Trainrun is missing departure section');
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
      throw new Error('Cycle detected in trainrun');
    }
    seenSectionIds.add(section.id);
  }

  // If we haven't seen all sections belonging to the trainrun, it's because
  // it's made up of multiple separate parts
  if (orderedSections.length !== sections.length) {
    throw new Error('Trainrun is not continuous');
  }

  return orderedSections;
};

const DEFAULT_PAYLOAD: Pick<PacedTrain, 'constraint_distribution' | 'rolling_stock_name'> = {
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
): Promise<{ trigram: string; secondary_code?: string; id: string }[]> => {
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
): { at: string; arrival: string; stop_for: string | null }[] =>
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
 * Generate properties for trainrun related caracteristics.
 */
const generateTrainrunProperties = async (
  netzgrafikDto: NetzgrafikDto,
  trainrun: TrainrunDto,
  infraId: number,
  dispatch: AppDispatch,
  startTime?: string
) => {
  const trainrunSections = getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const path = await generatePath(trainrunSections, netzgrafikDto.nodes, infraId, dispatch);
  const trainrunLabels = compact(
    uniq(
      trainrun.labelIds.map(
        (labelId) => netzgrafikDto.labels.find((label) => label.id === labelId)?.label
      )
    )
  );
  const startDate = calculateStartDate(
    trainrunSections,
    startTime ? new Date(startTime) : new Date()
  );
  const schedule = generateSchedule(trainrunSections, netzgrafikDto.nodes, startDate);

  return { path, trainrunLabels, startDate, schedule };
};

/**
 * Generate a TimetableItem payload for update from a TimetableItem and Trainrun properties.
 * Handle the following cases:
 * - if the TimetableItem is initially a PacedTrain and the frequency is still PacedTrain
 * - if the TimetableItem is initially a PacedTrain and the frequency is now changed to TrainSchedule
 * - if the TimetableItem is initially a TrainSchedule and the frequency is still TrainSchedule
 * - if the TimetableItem is initially a TrainSchedule and the frequency is now changed to PacedTrain
 */
const generateTimetableItemForUpdate = async (
  trainrun: TrainrunDto,
  netzgrafikDto: NetzgrafikDto,
  infraId: number,
  dispatch: AppDispatch,
  state: MacroEditorState
): Promise<TrainScheduleBase | PacedTrain> => {
  const timetableItemId = state.timetableItemIdByNgeId.get(trainrun.id)!;
  const timetableItem = await fetchTimetableItem(timetableItemId, dispatch);
  const { path, trainrunLabels, startDate, schedule } = await generateTrainrunProperties(
    netzgrafikDto,
    trainrun,
    infraId,
    dispatch,
    timetableItem.start_time
  );
  const isPaced = isPacedTrainResponseWithPacedTrainId(timetableItem);
  let timetableItemWithoutId: TrainScheduleBase | PacedTrain;
  if (isPaced) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, timetable_id, paced, ...rest } = timetableItem;
    timetableItemWithoutId = rest;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, timetable_id, ...rest } = timetableItem;
    timetableItemWithoutId = rest;
  }
  return {
    ...timetableItemWithoutId,
    train_name: trainrun.name,
    labels: trainrunLabels,
    path,
    start_time: startDate.toISOString(),
    schedule,
    // If the TimetableItem is initially a PacedTrain and the frequency is still PacedTrain
    ...((isPaced && trainrun.frequencyId !== TRAIN_SCHEDULE_FREQUENCY_ID) ||
    // Or if the TimetableItem is initially a TrainSchedule and the frequency is now PacedTrain
    (!isPaced && trainrun.frequencyId !== TRAIN_SCHEDULE_FREQUENCY_ID)
      ? {
          paced: {
            duration: isPaced
              ? timetableItem.paced.duration
              : new Duration({ hours: 2 }).toISOString(), // when converting from TrainSchedule to PacedTrain
            step: new Duration({
              minutes: getFrequencyFromFrequencyId(state, trainrun.frequencyId).frequency,
            }).toISOString(),
          },
        }
      : {}),
  };
};

const handleCreateTimetableItem = async (
  netzgrafikDto: NetzgrafikDto,
  trainrun: TrainrunDto,
  timetableId: number,
  infraId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void
): Promise<void> => {
  const { path, trainrunLabels, startDate, schedule } = await generateTrainrunProperties(
    netzgrafikDto,
    trainrun,
    infraId,
    dispatch
  );
  const pacedTrain: PacedTrain = {
    ...DEFAULT_PAYLOAD,
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
  const newTimetableItems = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
      id: timetableId,
      body: [pacedTrain],
    })
  ).unwrap();
  if (newTimetableItems.length === 0) {
    throw new Error('Failed to create paced train');
  }
  const newPacedTrain: PacedTrainResponseWithPacedTrainId = {
    ...newTimetableItems[0],
    id: formatEditoastTrainIdToPacedTrainId(newTimetableItems[0].id),
  };
  state.timetableItemIdByNgeId.set(trainrun.id, newPacedTrain.id);
  addUpsertedTimetableItems([newPacedTrain]);
};

const handleUpdateTimetableItem = async ({
  netzgrafikDto,
  trainrun,
  timetableId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  netzgrafikDto: NetzgrafikDto;
  trainrun: TrainrunDto;
  infraId: number;
  timetableId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
}): Promise<void> => {
  const timetableItemForUpdate = await generateTimetableItemForUpdate(
    trainrun,
    netzgrafikDto,
    infraId,
    dispatch,
    state
  );
  let updatedTimetableItem: TimetableItemWithTimetableId;
  if (getFrequencyFromFrequencyId(state, trainrun.frequencyId).id === TRAIN_SCHEDULE_FREQUENCY_ID) {
    updatedTimetableItem = await storeTrainSchedule(
      state.timetableItemIdByNgeId.get(trainrun.id)!,
      timetableItemForUpdate,
      timetableId,
      dispatch,
      addUpsertedTimetableItems,
      addDeletedTimetableItemIds
    );
  } else {
    updatedTimetableItem = await storePacedTrain(
      state.timetableItemIdByNgeId.get(trainrun.id)!,
      timetableItemForUpdate as PacedTrain,
      timetableId,
      dispatch,
      addUpsertedTimetableItems,
      addDeletedTimetableItemIds
    );
  }
  state.timetableItemIdByNgeId.set(trainrun.id, updatedTimetableItem.id);
};

const handleDeleteTimetableItem = async (
  trainrunId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void
): Promise<void> => {
  const timetableItemId = state.timetableItemIdByNgeId.get(trainrunId)!;
  const editoastTrainId = isPacedTrain(timetableItemId)
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
  state.timetableItemIdByNgeId.delete(trainrunId);
};

const handleTrainrunOperation = async ({
  type,
  netzgrafikDto,
  trainrunId,
  timetableId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  type: NGEEvent['type'];
  netzgrafikDto: NetzgrafikDto;
  trainrunId: number;
  timetableId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
}): Promise<void> => {
  const trainrun = netzgrafikDto.trainruns.find((tr) => tr.id === trainrunId);
  switch (type) {
    case 'create': {
      await handleCreateTimetableItem(
        netzgrafikDto,
        trainrun!,
        timetableId,
        infraId,
        state,
        dispatch,
        addUpsertedTimetableItems
      );
      break;
    }
    case 'update': {
      await handleUpdateTimetableItem({
        netzgrafikDto,
        trainrun: trainrun!,
        timetableId,
        infraId,
        dispatch,
        state,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds,
      });
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
  netzgrafikDto,
  label,
  timetableId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  type: NGEEvent['type'];
  netzgrafikDto: NetzgrafikDto;
  label: LabelDto;
  timetableId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
}) => {
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
          timetableId,
          infraId,
          state,
          dispatch,
          addUpsertedTimetableItems,
          addDeletedTimetableItemIds,
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
  netzgrafikDto,
  timetableId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  event: NGEEvent;
  netzgrafikDto: NetzgrafikDto;
  timetableId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
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
        netzgrafikDto,
        trainrunId: event.trainrun.id,
        timetableId,
        infraId,
        state,
        dispatch,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds,
      });
      break;
    }
    case 'label':
      await handleLabelOperation({
        type,
        netzgrafikDto,
        label: event.label,
        timetableId,
        infraId,
        state,
        dispatch,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds,
      });
      break;
    default:
      break;
  }
};

export default handleOperation;
