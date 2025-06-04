import { compact, uniq } from 'lodash';

import {
  osrdEditoastApi,
  type PacedTrain,
  type SearchResultItemOperationalPoint,
  type TrainSchedule,
} from 'common/api/osrdEditoastApi';
import { checkChangeGroups } from 'modules/trainschedule/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import {
  fetchTimetableItem,
  storePacedTrain,
  storeTrainSchedule,
} from 'modules/trainschedule/helpers/updateTimetableItemHelpers';
import type {
  PacedTrainResponseWithPacedTrainId,
  TimetableItemId,
  TimetableItem,
} from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  isPacedTrainId,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

import {
  DEFAULT_PACED_TRAIN_PAYLOAD,
  DEFAULT_TIME_WINDOW,
  TRAIN_SCHEDULE_FREQUENCY_ID,
} from './consts';
import type MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';
import {
  createMacroNode,
  deleteMacroNodeByNgeId,
  getFrequencyFromFrequencyId,
  getTrainCategoryFromId,
  updateMacroNode,
} from './utils';
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
      deleted: false,
      // TODO : handle this case in xml import refacto
      track_reference: null,
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
    deleted: false,
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
export const generatePath = async (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  infraId: number,
  dispatch: AppDispatch
): Promise<TrainSchedule['path']> => {
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
const calculateStartDate = (trainrunSections: TrainrunSectionDto[], startDate: Date): Date => {
  // The departure time of the first section is guaranteed to be non-null
  const startTimeLock = trainrunSections[0].sourceDeparture;
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
): TrainSchedule['schedule'] =>
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
      // Default information
      locked: false,
      reception_signal: 'OPEN',
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
  oldStartDate?: Date
) => {
  const trainrunSections = getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const path = await generatePath(trainrunSections, netzgrafikDto.nodes, infraId, dispatch);
  const labels = compact(
    uniq(
      trainrun.labelIds.map(
        (labelId) => netzgrafikDto.labels.find((label) => label.id === labelId)?.label
      )
    )
  );
  const startDate = calculateStartDate(trainrunSections, oldStartDate || new Date());
  const schedule = generateSchedule(trainrunSections, netzgrafikDto.nodes, startDate);

  return { path, labels, startDate, schedule };
};

const createPacedAttributesFromTrainrun = (trainrun: TrainrunDto, state: MacroEditorState) => ({
  time_window: DEFAULT_TIME_WINDOW.toISOString(),
  interval: new Duration({
    minutes: getFrequencyFromFrequencyId(state, trainrun.frequencyId).frequency,
  }).toISOString(),
});

/**
 * By default (in NGE code), a newly created trainrun has a frequencyId of 3,
 * which is equivalent to a PacedTrain (paced.interval = 60min).
 * No TrainSchedule can be created here, but only updated from an existing PacedTrain.
 */
const handleCreateTimetableItem = async (
  netzgrafikDto: NetzgrafikDto,
  trainrun: TrainrunDto,
  timetableId: number,
  infraId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void
) => {
  const { path, labels, startDate, schedule } = await generateTrainrunProperties(
    netzgrafikDto,
    trainrun,
    infraId,
    dispatch
  );
  const pacedTrain: PacedTrain = {
    ...DEFAULT_PACED_TRAIN_PAYLOAD,
    paced: createPacedAttributesFromTrainrun(trainrun, state),
    train_name: trainrun.name,
    labels,
    path,
    start_time: startDate.toISOString(),
    schedule,
    exceptions: [],
    category: getTrainCategoryFromId(trainrun.categoryId),
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
    id: formatEditoastIdToPacedTrainId(newTimetableItems[0].id),
  };
  state.timetableItemIdByNgeId.set(trainrun.id, newPacedTrain.id);
  addUpsertedTimetableItems([newPacedTrain]);
};

/**
 * Handle the following cases:
 * - if the TimetableItem is initially a PacedTrain and the frequency is still PacedTrain (`paced` time window is keep identical and interval to corresponding TrainrunFrequency)
 * - if the TimetableItem is initially a PacedTrain and the frequency is now changed to TrainSchedule (`paced` set to undefined)
 * - if the TimetableItem is initially a TrainSchedule and the frequency is still TrainSchedule (`paced` set to undefined)
 * - if the TimetableItem is initially a TrainSchedule and the frequency is now changed to PacedTrain (`paced` time window set to 2 hours and interval to corresponding TrainrunFrequency)
 */
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
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
}) => {
  const timetableItemId = state.timetableItemIdByNgeId.get(trainrun.id)!;
  const timetableItem = await fetchTimetableItem(timetableItemId, dispatch);
  const { path, labels, startDate, schedule } = await generateTrainrunProperties(
    netzgrafikDto,
    trainrun,
    infraId,
    dispatch,
    new Date(timetableItem.start_time)
  );

  const { id: _id, timetable_id: _timetableId, ...timetableItemBase } = timetableItem;
  const timetableItemForUpdate = {
    ...timetableItemBase,
    train_name: trainrun.name,
    labels,
    path,
    start_time: startDate.toISOString(),
    schedule,
    paced: undefined,
    exceptions: undefined,
    category: getTrainCategoryFromId(trainrun.categoryId),
  };

  let updatedTimetableItem: TimetableItem;
  if (trainrun.frequencyId === TRAIN_SCHEDULE_FREQUENCY_ID) {
    updatedTimetableItem = await storeTrainSchedule(
      timetableItemId,
      timetableItemForUpdate,
      timetableId,
      dispatch,
      addUpsertedTimetableItems,
      addDeletedTimetableItemIds
    );
  } else {
    const paced = {
      interval: new Duration({
        minutes: getFrequencyFromFrequencyId(state, trainrun.frequencyId).frequency,
      }).toISOString(),
      time_window: isPacedTrainResponseWithPacedTrainId(timetableItem)
        ? timetableItem.paced.time_window
        : DEFAULT_TIME_WINDOW.toISOString(),
    };

    const basePacedTrain = {
      ...timetableItemForUpdate,
      paced,
    };
    const updatedPacedTrain: PacedTrain = {
      ...basePacedTrain,
      exceptions: isPacedTrainResponseWithPacedTrainId(timetableItem)
        ? checkChangeGroups(basePacedTrain, timetableItem.exceptions)
        : [],
    };

    updatedTimetableItem = await storePacedTrain(
      timetableItemId,
      updatedPacedTrain,
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
) => {
  const timetableItemId = state.timetableItemIdByNgeId.get(trainrunId)!;
  const editoastTrainId = isPacedTrainId(timetableItemId)
    ? extractEditoastIdFromPacedTrainId(timetableItemId)
    : extractEditoastIdFromTrainScheduleId(timetableItemId);
  const endpoint = isPacedTrainId(timetableItemId)
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
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
}) => {
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
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
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
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
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
