import { compact, uniq } from 'lodash';

import {
  type TrainSchedule,
  type PathItemLocation,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import {
  createPacedTrains,
  deleteTrainSchedules,
  fetchTimetableItem,
  storePacedTrain,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { updateSelectedTrain } from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { Duration } from 'utils/duration';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

import { checkChangeGroups } from '../../ManageTimetableItem/helpers/buildPacedTrainException';
import type {
  NetzgrafikDto,
  NGEEvent,
  TrainrunSectionDto,
  NodeDto,
  TimeLockDto,
  TrainrunDto,
} from '../../NGE/types';
import {
  DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
  DEFAULT_TIME_WINDOW,
  TRAINRUN_DIRECTIONS,
} from '../consts';
import MacroEditorState from '../MacroEditorState';
import {
  fetchStationSecondaryCode,
  getFrequencyFromFrequencyId,
  getTrainCategoryFromTrainrunCategoryId,
  storeRoundTrip,
} from '../utils';

const getNodeById = (nodes: NodeDto[], nodeId: number | string) =>
  nodes.find((node) => node.id === nodeId);

const findConnectedPortId = (node: NodeDto, portId: number) => {
  const transition = node.transitions.find((tr) => tr.port1Id === portId || tr.port2Id === portId);
  if (!transition) {
    return null;
  }
  return transition.port1Id === portId ? transition.port2Id : transition.port1Id;
};

/**
 * Get the trainrun sections corresponding to a given trainrun id,
 * group them in continuous subpaths,
 * and order them according to these subpaths.
 * For example on a train run containing (B->C, D->E, A->B),
 * the function would group and order the sections as [[A->B, B->C], [D->E]] or [[D->E], [A->B, B->C]].
 */
export const getTrainrunSectionsByTrainrunId = (
  netzgrafikDto: NetzgrafikDto,
  trainrunId: number
): TrainrunSectionDto[][] => {
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
  // Two subsequent sections can be linked together at a node by connecting
  // each section's source or target to a transition via a port. Example:
  //
  //     const node = { id: 10, transitions: [{ port1Id: 30, port2Id: 31 }], … };
  //     const leftSection = { id: 20, targetNodeId: 10, targetPortId: 30, … };
  //     const rightSection = { id: 21, sourceNodeId: 10, sourcePortId: 31, … };
  //
  // Build a map of sections keyed by the outgoing port ID they are connected
  // to. Find the leaf (departure/arrival) sections: these are the ones without
  // a transition for their source or target port.
  const sectionsByConnectedPortId = new Map<number, TrainrunSectionDto>();
  const leafSections: TrainrunSectionDto[] = [];
  for (const section of sections) {
    const sourceNode = getNodeById(netzgrafikDto.nodes, section.sourceNodeId)!;
    const sourceConnectedPortId = findConnectedPortId(sourceNode, section.sourcePortId);

    if (sourceConnectedPortId === null) {
      leafSections.push(section);
    } else {
      sectionsByConnectedPortId.set(sourceConnectedPortId, section);
    }
  }

  // Start with a leaf node and walk over the path. Ignore any leaf node we've
  // already seen (because we've reached it at the end of a previous walk).
  const seenSectionIds = new Set<number>();
  const orderedSectionPaths = [];
  for (const startSection of leafSections) {
    if (seenSectionIds.has(startSection.id)) {
      continue;
    }

    let section: TrainrunSectionDto | undefined = startSection;
    const orderedSections = [];
    while (section) {
      // Make sure we don't enter an infinite loop
      if (seenSectionIds.has(section.id)) {
        throw new Error('Cycle detected in trainrun');
      }
      seenSectionIds.add(section.id);

      orderedSections.push(section);
      section = sectionsByConnectedPortId.get(section.targetPortId);
    }

    orderedSectionPaths.push(orderedSections);
  }

  // We should've seen all of the train run's sections by now
  if (seenSectionIds.size !== sections.length) {
    throw new Error('Trainrun graph search failed to find all sections');
  }

  if (orderedSectionPaths.length === 0) {
    throw new Error('Trainrun has no path');
  }

  return orderedSectionPaths;
};

const createPathItemFromNode = (
  node: NodeDto,
  index: number,
  state?: MacroEditorState
): TrainSchedule['path'][number] => {
  let pathItemLocation: PathItemLocation;
  if (state) {
    const indexedNode = state.getNodeByNgeId(node.id)!;
    pathItemLocation = MacroEditorState.parsePathKey(indexedNode.path_item_key);
  } else {
    const [trigram, secondary_code] = node.betriebspunktName.split('/');
    // TODO : handle this case in xml import refacto
    pathItemLocation = {
      type: 'operational_point_part_reference',
      operational_point: { trigram, secondary_code, type: 'trigram' },
      local_track_name: null,
    };
  }
  return {
    location: pathItemLocation,
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
export const generatePath = (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  trainrunDirection: TRAINRUN_DIRECTIONS,
  state?: MacroEditorState
): TrainSchedule['path'] => {
  const isForward = trainrunDirection === TRAINRUN_DIRECTIONS.FORWARD;
  const path = trainrunSections.map((section, index) => {
    const fromNode = getNodeById(nodes, isForward ? section.sourceNodeId : section.targetNodeId);
    const toNode = getNodeById(nodes, isForward ? section.targetNodeId : section.sourceNodeId);
    if (!fromNode || !toNode) return [];
    const originPathItem = createPathItemFromNode(fromNode, index, state);
    if (index === trainrunSections.length - 1) {
      const destinationPathItem = createPathItemFromNode(toNode, index + 1, state);
      return [originPathItem, destinationPathItem];
    }
    return [originPathItem];
  });
  return path.flat();
};

/**
 * Calculate the start date of a trainrun.
 */
const calculateStartDate = (
  trainrunSections: TrainrunSectionDto[],
  baseDate: Date,
  trainrunDirection: TRAINRUN_DIRECTIONS = TRAINRUN_DIRECTIONS.FORWARD
): Date => {
  // The departure time of the first section is guaranteed to be non-null
  const startTimeLock =
    trainrunDirection === TRAINRUN_DIRECTIONS.BACKWARD
      ? trainrunSections[0].targetDeparture
      : trainrunSections[0].sourceDeparture;
  const startDate = new Date(baseDate);
  startDate.setMinutes(startTimeLock.time!, 0, 0);
  return startDate;
};

/**
 * Generate a schedule (list of stops with their arrival and departure times)
 * from a list of trainrun sections.
 * The schedule is generated based on the trainrun direction.
 */
const generateSchedule = (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  startDate: Date,
  trainrunDirection: TRAINRUN_DIRECTIONS
): TrainSchedule['schedule'] => {
  const isForward = trainrunDirection === TRAINRUN_DIRECTIONS.FORWARD;
  return trainrunSections.flatMap((section, index) => {
    const nextSection = trainrunSections[index + 1];
    const toNodeId = isForward ? section.targetNodeId : section.sourceNodeId;
    const toPortId = isForward ? section.targetPortId : section.sourcePortId;

    const transition = getNodeById(nodes, toNodeId)!.transitions.find(
      (tr) => tr.port1Id === toPortId || tr.port2Id === toPortId
    );
    const isStopTransit = !(transition?.isNonStopTransit ?? false);

    // Note that "arrival" is the time the train arrives at the node
    // and "departure" is the time the train leaves the node
    const firstSection = trainrunSections[0];
    const arrivalTimeLock = isForward ? section.targetArrival : section.sourceArrival;
    const trainrunStartTimeLock = isForward
      ? firstSection.sourceDeparture
      : firstSection.targetDeparture;

    let arrival = getTimeLockDate(arrivalTimeLock, trainrunStartTimeLock, startDate);
    let departure: Date | null = null;
    if (nextSection) {
      const nextDepartureTimeLock = isForward
        ? nextSection.sourceDeparture
        : nextSection.targetDeparture;
      departure = getTimeLockDate(nextDepartureTimeLock, trainrunStartTimeLock, startDate);
    }

    if (!arrival && !departure) {
      if (index === trainrunSections.length - 1) {
        // In micro, by default we put a zero stop duration on the destination
        // to make the train stop.
        // This need to be done here so it doesn't make an exception pop because the
        // destination is not configured the same way in macro.
        return {
          at: `${toNodeId}-${index + 1}`,
          stop_for: Duration.zero.toISOString(),
          // Default information
          reception_signal: 'OPEN',
        };
      }
      return [];
    }

    // If missing arrival time, default to a zero stop duration
    arrival = arrival || departure!;

    let stop_for: string | null = null;
    if (isStopTransit)
      stop_for = departure
        ? formatDateDifferenceFrom(arrival, departure)
        : Duration.zero.toISOString();

    return {
      at: `${toNodeId}-${index + 1}`,
      arrival: formatDateDifferenceFrom(startDate, arrival),
      stop_for,
      // Default information
      reception_signal: 'OPEN',
    };
  });
};

/**
 * Get the trainrun sections corresponding to a given trainrun id,
 * and order them according to the train path.
 * For example, (B->C, C->D, A->B) would become (A->B, B->C, C->D).
 * Fails if the trainrun is not continuous (for example (A->B, C->D)).
 */
const getContinuousTrainrunSectionsByTrainrunId = (
  netzgrafikDto: NetzgrafikDto,
  trainrunId: number
) => {
  const groupedTrainrunSections = getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrunId);
  if (groupedTrainrunSections.length > 1) {
    throw new Error('Trainrun is not continuous');
  }
  return groupedTrainrunSections[0];
};

export const getTrainrunLabels = (netzgrafikDto: NetzgrafikDto, trainrun: TrainrunDto) =>
  compact(
    uniq(
      trainrun.labelIds.map(
        (labelId) => netzgrafikDto.labels.find((label) => label.id === labelId)?.label
      )
    )
  );

/**
 * Generate start time, path and schedule from a trainrun. If the trainrun is
 * backward, the sections are reversed.
 */
export const generatePathAndSchedule = (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  baseDate?: Date,
  trainrunDirection: TRAINRUN_DIRECTIONS = TRAINRUN_DIRECTIONS.FORWARD,
  state?: MacroEditorState
) => {
  let sections = trainrunSections;
  if (trainrunDirection === TRAINRUN_DIRECTIONS.BACKWARD) {
    sections = [...trainrunSections].reverse();
  }

  const startDate = calculateStartDate(sections, baseDate ?? new Date(), trainrunDirection);
  const path = generatePath(sections, nodes, trainrunDirection, state);
  const schedule = generateSchedule(sections, nodes, startDate, trainrunDirection);
  return { start_time: startDate.toISOString(), path, schedule };
};

// TODO: drop this function once this PR is merged:
// https://github.com/OpenRailAssociation/osrd/pull/10325
const populateSecondaryCodesInPath = async (
  path: TrainSchedule['path'],
  infraId: number,
  dispatch: AppDispatch
) => {
  const promises = path.map(async (pathItem) => {
    if (
      pathItem.location.type === 'track_offset' ||
      pathItem.location.operational_point.type !== 'trigram' ||
      pathItem.location.operational_point.secondary_code
    ) {
      return;
    }
    pathItem.location.operational_point.secondary_code = await fetchStationSecondaryCode(
      pathItem.location.operational_point.trigram,
      infraId,
      dispatch
    );
  });

  await Promise.all(promises);
};

export const createPacedAttributesFromTrainrun = (
  trainrun: TrainrunDto,
  dto: NetzgrafikDto
): TrainSchedule['paced'] => {
  const freq = getFrequencyFromFrequencyId(dto.metadata.trainrunFrequencies, trainrun.frequencyId);
  const interval = new Duration({ minutes: freq.frequency });
  if (interval >= new Duration({ hours: 24 })) {
    // We use a 24-hour interval to indicate that a train isn't paced
    return null;
  }
  return {
    interval: interval.toISOString(),
    time_window: DEFAULT_TIME_WINDOW.toISOString(),
    exceptions: [],
  };
};

/**
 * By default (in NGE code), a newly created trainrun has a frequencyId of 3,
 * which is equivalent to a PacedTrain (paced.interval = 60min).
 * No UniqueTrain can be created here, but only updated from an existing PacedTrain.
 */
const handleCreateTimetableItem = async (
  netzgrafikDto: NetzgrafikDto,
  trainrun: TrainrunDto,
  trainScheduleSetId: number,
  infraId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void
) => {
  const trainrunSections = getContinuousTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const labels = getTrainrunLabels(netzgrafikDto, trainrun);

  const pathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    undefined,
    TRAINRUN_DIRECTIONS.FORWARD,
    state
  );

  const returnPathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    undefined,
    TRAINRUN_DIRECTIONS.BACKWARD,
    state
  );

  await populateSecondaryCodesInPath(
    [...pathAndSchedule.path, ...returnPathAndSchedule.path],
    infraId,
    dispatch
  );
  const category = getTrainCategoryFromTrainrunCategoryId(
    state.trainrunCategories,
    trainrun.categoryId
  );

  const paced = createPacedAttributesFromTrainrun(trainrun, netzgrafikDto);

  const forwardTrip: TrainSchedule = {
    ...DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
    paced,
    train_name: trainrun.name,
    labels,
    category,
    ...pathAndSchedule,
  };

  const returnTrip =
    trainrun.direction === 'round_trip' ? { ...forwardTrip, ...returnPathAndSchedule } : undefined;

  const timetableItemsToCreate = returnTrip ? [forwardTrip, returnTrip] : [forwardTrip];

  const newTimetableItems: TimetableItem[] = await createPacedTrains(
    dispatch,
    trainScheduleSetId,
    timetableItemsToCreate
  );
  if (newTimetableItems.length !== timetableItemsToCreate.length) {
    throw new Error('Failed to create timetable item(s)');
  }
  addUpsertedTimetableItems(newTimetableItems);
  dispatch(
    updateSelectedTrain({
      id: formatEditoastIdToPacedTrainId(newTimetableItems[0].id),
      by: 'timetable',
    })
  );

  const newTrainIds: [number, number | null] = [
    newTimetableItems[0].id,
    newTimetableItems.at(1)?.id ?? null,
  ];
  state.timetableItemIdByNgeId.set(trainrun.id, newTrainIds);
  storeRoundTrip(dispatch, newTrainIds[0], newTrainIds[1] ?? undefined);
};

const deleteTimetableItemById = async (
  timetableItemId: number,
  dispatch: AppDispatch,
  addDeletedTimetableItemIds: (timetableItemIds: number[]) => void
) => {
  await deleteTrainSchedules(dispatch, [timetableItemId]);

  addDeletedTimetableItemIds([timetableItemId]);
};

const handleDeleteTimetableItem = async (
  trainrunId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addDeletedTimetableItemIds: (timetableItemIds: number[]) => void
) => {
  const timetableItemIds = state.timetableItemIdByNgeId.get(trainrunId);
  for (const timetableItemId of timetableItemIds ?? []) {
    if (timetableItemId) {
      await deleteTimetableItemById(timetableItemId, dispatch, addDeletedTimetableItemIds);
    }
  }
  state.timetableItemIdByNgeId.delete(trainrunId);
};

/**
 * Handle the following cases:
 * - if the TrainSchedule is initially a PacedTrain and the frequency is still PacedTrain (`paced` time window is keep identical and interval to corresponding TrainrunFrequency)
 * - if the TrainSchedule is initially a PacedTrain and the frequency is now changed to UniqueTrain (`paced` set to undefined)
 * - if the TrainSchedule is initially a UniqueTrain and the frequency is still UniqueTrain (`paced` set to undefined)
 * - if the TrainSchedule is initially a UniqueTrain and the frequency is now changed to PacedTrain (`paced` time window set to 2 hours and interval to corresponding TrainrunFrequency)
 * Also handles conversion from round trips to one way trips and the inverse.
 */
export const handleUpdateTimetableItem = async ({
  netzgrafikDto,
  trainrun,
  trainScheduleSetId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  netzgrafikDto: NetzgrafikDto;
  trainrun: TrainrunDto;
  infraId: number;
  trainScheduleSetId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: number[]) => void;
}) => {
  const timetableItemIds = state.timetableItemIdByNgeId.get(trainrun.id);
  if (!timetableItemIds) return;
  const oldForwardTimetableItem = await fetchTimetableItem(timetableItemIds[0], dispatch);
  const trainrunSections = getContinuousTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const labels = getTrainrunLabels(netzgrafikDto, trainrun);
  const forwardPathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    new Date(oldForwardTimetableItem.start_time),
    TRAINRUN_DIRECTIONS.FORWARD,
    state
  );
  await populateSecondaryCodesInPath(forwardPathAndSchedule.path, infraId, dispatch);

  const { id: _id, ...timetableItemBase } = oldForwardTimetableItem;

  const category = getTrainCategoryFromTrainrunCategoryId(
    state.trainrunCategories,
    trainrun.categoryId
  );

  const paced = createPacedAttributesFromTrainrun(trainrun, netzgrafikDto);

  const newForwardTrainBase: Omit<TrainScheduleResponse, 'id'> = {
    ...timetableItemBase,
    train_name: trainrun.name,
    labels,
    // Reset margins because they contain references to path items
    margins: undefined,
    paced,
    category,
    ...forwardPathAndSchedule,
  };

  if (paced && oldForwardTimetableItem.paced) {
    paced.time_window = oldForwardTimetableItem.paced.time_window;
    paced.exceptions = checkChangeGroups(
      newForwardTrainBase,
      paced,
      oldForwardTimetableItem.paced.exceptions
    ).exceptions;
    newForwardTrainBase.paced = paced;
  }

  const newForwardTimetableItem = await storePacedTrain(
    oldForwardTimetableItem.id,
    newForwardTrainBase,
    dispatch,
    addUpsertedTimetableItems
  );

  if (trainrun.direction === 'one_way') {
    if (timetableItemIds[1]) {
      // NGE always selects the forward trip by default when going from round trip to one way trip,
      // thus the trip that needs to be deleted is always the return trip
      await storeRoundTrip(dispatch, newForwardTimetableItem.id);
      await deleteTimetableItemById(timetableItemIds[1], dispatch, addDeletedTimetableItemIds);
    }

    state.timetableItemIdByNgeId.set(trainrun.id, [newForwardTimetableItem.id, null]);
    return;
  }

  const returnPathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    new Date(oldForwardTimetableItem.start_time),
    TRAINRUN_DIRECTIONS.BACKWARD,
    state
  );

  await populateSecondaryCodesInPath(returnPathAndSchedule.path, infraId, dispatch);

  let newReturnTimetableItem: TimetableItem;
  const returnPaced: TrainSchedule['paced'] = paced ? { ...paced, exceptions: [] } : null;

  if (timetableItemIds[1]) {
    // update return if already present
    const oldReturnTimetableItem = await fetchTimetableItem(timetableItemIds[1], dispatch);
    const { id: _return_id, ...oldReturnTrainBase } = oldReturnTimetableItem;
    const newReturnTrainBase: Omit<TrainScheduleResponse, 'id'> = {
      ...oldReturnTrainBase,
      train_name: trainrun.name,
      labels,
      // Reset margins because they contain references to path items
      margins: undefined,
      paced: returnPaced,
      category,
      ...returnPathAndSchedule,
    };

    if (returnPaced && oldReturnTimetableItem.paced) {
      returnPaced.time_window = oldReturnTimetableItem.paced.time_window;
      returnPaced.exceptions = checkChangeGroups(
        newReturnTrainBase,
        returnPaced,
        oldReturnTimetableItem.paced.exceptions
      ).exceptions;
      newReturnTrainBase.paced = returnPaced;
    }

    newReturnTimetableItem = await storePacedTrain(
      oldReturnTimetableItem.id,
      newReturnTrainBase,
      dispatch,
      addUpsertedTimetableItems
    );
  } else {
    // otherwise create return

    // Remove train_schedule_set_id before creating paced train as we don't want to pass it in the payload
    const { train_schedule_set_id: _trainScheduleSetId, ...pacedTrainWithoutTrainScheduleSetId } =
      newForwardTrainBase;

    const returnPacedTrain: TrainSchedule = {
      ...pacedTrainWithoutTrainScheduleSetId,
      ...returnPathAndSchedule,
      paced: returnPaced,
    };

    newReturnTimetableItem = (
      await createPacedTrains(dispatch, trainScheduleSetId, [returnPacedTrain])
    )[0];

    addUpsertedTimetableItems([newReturnTimetableItem]);
  }

  // Ensure the round-trip association is kept after updates/conversions
  await storeRoundTrip(dispatch, newForwardTimetableItem.id, newReturnTimetableItem.id);

  state.timetableItemIdByNgeId.set(trainrun.id, [
    newForwardTimetableItem.id,
    newReturnTimetableItem.id,
  ]);
};

export const handleTrainrunOperation = async ({
  type,
  netzgrafikDto,
  trainrunId,
  trainScheduleSetId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  type: NGEEvent['type'];
  netzgrafikDto: NetzgrafikDto;
  trainrunId: number;
  trainScheduleSetId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: number[]) => void;
}) => {
  const trainrun = netzgrafikDto.trainruns.find((tr) => tr.id === trainrunId);
  switch (type) {
    case 'create': {
      await handleCreateTimetableItem(
        netzgrafikDto,
        trainrun!,
        trainScheduleSetId,
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
        trainScheduleSetId,
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

export const updateTrainrunsByNode = async ({
  state,
  netzgrafikDto,
  dispatch,
  infraId,
  trainScheduleSetId,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
  node,
}: {
  state: MacroEditorState;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
  infraId: number;
  trainScheduleSetId: number;
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: number[]) => void;
  node: NodeDto;
}) => {
  const trainrunsById = new Map<number, TrainrunDto>();
  for (const trainrun of netzgrafikDto.trainruns) {
    trainrunsById.set(trainrun.id, trainrun);
  }

  const trainruns = new Set<TrainrunDto>();
  for (const trainrunSection of netzgrafikDto.trainrunSections) {
    if (trainrunSection.sourceNodeId === node.id || trainrunSection.targetNodeId === node.id) {
      const trainrun = trainrunsById.get(trainrunSection.trainrunId)!;
      trainruns.add(trainrun);
    }
  }

  for (const trainrun of trainruns) {
    await handleUpdateTimetableItem({
      netzgrafikDto,
      trainrun,
      trainScheduleSetId,
      infraId,
      dispatch,
      state,
      addUpsertedTimetableItems,
      addDeletedTimetableItemIds,
    });
  }
};
