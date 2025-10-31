import { compact, uniq } from 'lodash';

import type {
  PacedTrainFromJson,
  TrainScheduleFromJson,
} from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type MacroNodeForm,
  type PacedTrain,
  type SearchResultItemOperationalPoint,
  type TrainSchedule,
  type PathItemLocation,
} from 'common/api/osrdEditoastApi';
import {
  createPacedTrain,
  createTrainSchedule,
  deletePacedTrains,
  deleteTrainSchedules,
  fetchTimetableItem,
  storePacedTrain,
  storeTrainSchedule,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type {
  PacedTrainWithPacedTrainId,
  TimetableItemId,
  TimetableItem,
  TrainScheduleId,
  PacedTrainId,
} from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
  formatEditoastIdToPacedTrainId,
  isPacedTrainId,
  isPacedTrainResponseWithPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import {
  DEFAULT_PACED_TRAIN_PAYLOAD,
  DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
  DEFAULT_TIME_WINDOW,
  TRAINRUN_DIRECTIONS,
} from './consts';
import MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';
import {
  createMacroNode,
  deleteMacroNodeByNgeId,
  getFrequencyFromFrequencyId,
  getTrainCategoryFromTrainrunCategoryId,
  updateMacroNode,
} from './utils';
import { checkChangeGroups } from '../ManageTimetableItem/helpers/buildPacedTrainException';
import type {
  FreeFloatingTextDto,
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
const getTrainrunSectionsByTrainrunId = (
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
    pathItemLocation = { trigram, secondary_code };
  }
  return {
    ...pathItemLocation,
    id: `${node.id}-${index}`,
    deleted: false,
    // TODO : handle this case in xml import refacto
    track_reference: null,
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
          locked: false,
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
      locked: false,
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

const getTrainrunLabels = (netzgrafikDto: NetzgrafikDto, trainrun: TrainrunDto) =>
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
const generatePathAndSchedule = (
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
    if (!('trigram' in pathItem) || pathItem.secondary_code) {
      return;
    }

    const searchPayload = {
      object: 'operationalpoint',
      query: ['and', ['=', ['infra_id'], infraId], ['=', ['trigram'], pathItem.trigram]],
    };
    const searchResults = (await dispatch(
      osrdEditoastApi.endpoints.postSearch.initiate({
        searchPayload,
      })
    ).unwrap()) as SearchResultItemOperationalPoint[];

    const stationOp = searchResults.find((op) => op.ch === 'BV' || op.ch === '00');
    pathItem.secondary_code = stationOp?.ch;
  });

  await Promise.all(promises);
};

const createPacedAttributesFromTrainrun = (trainrun: TrainrunDto, dto: NetzgrafikDto) => {
  const freq = getFrequencyFromFrequencyId(dto.metadata.trainrunFrequencies, trainrun.frequencyId);
  const interval = new Duration({ minutes: freq.frequency });
  if (interval >= new Duration({ hours: 24 })) {
    // We use a 24-hour interval to indicate that a train isn't paced
    return null;
  }
  return {
    interval: interval.toISOString(),
    time_window: DEFAULT_TIME_WINDOW.toISOString(),
  };
};

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
  const trainrunSections = getContinuousTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const labels = getTrainrunLabels(netzgrafikDto, trainrun);

  if (trainrun.direction === 'one_way') {
    throw new Error(
      'ngeToOsrd handleCreateTimetableItem received a one_way train dto instead of a round trip'
    );
  }
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

  const pacedTrain: PacedTrain = {
    ...DEFAULT_PACED_TRAIN_PAYLOAD,
    paced: createPacedAttributesFromTrainrun(trainrun, netzgrafikDto)!,
    train_name: trainrun.name,
    labels,
    category,
    ...pathAndSchedule,
  };
  const returnPacedTrain = { ...pacedTrain, ...returnPathAndSchedule };

  const newTimetableItems = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
      id: timetableId,
      body: [pacedTrain, returnPacedTrain],
    })
  ).unwrap();
  if (newTimetableItems.length !== 2) {
    throw new Error('Failed to create paced train with return trip');
  }
  await dispatch(
    osrdEditoastApi.endpoints.postRoundTripsPacedTrains.initiate({
      roundTrips: { round_trips: [[newTimetableItems[0].id, newTimetableItems[1].id]] },
    })
  ).unwrap();

  const newPacedTrain: PacedTrainWithPacedTrainId = {
    ...newTimetableItems[0],
    id: formatEditoastIdToPacedTrainId(newTimetableItems[0].id),
  };
  const newReturnPacedTrain: PacedTrainWithPacedTrainId = {
    ...newTimetableItems[1],
    id: formatEditoastIdToPacedTrainId(newTimetableItems[1].id),
  };
  state.timetableItemIdByNgeId.set(trainrun.id, [newPacedTrain.id, newReturnPacedTrain.id]);
  addUpsertedTimetableItems([newPacedTrain, newReturnPacedTrain]);
};

const deleteTimetableItemById = async (
  timetableItemId: TimetableItemId,
  dispatch: AppDispatch,
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void
) => {
  if (isPacedTrainId(timetableItemId)) await deletePacedTrains(dispatch, [timetableItemId]);
  else await deleteTrainSchedules(dispatch, [timetableItemId]);

  addDeletedTimetableItemIds([timetableItemId]);
};

const handleDeleteTimetableItem = async (
  trainrunId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void
) => {
  const timetableItemIds = state.timetableItemIdByNgeId.get(trainrunId);
  for (const timetableItemId of timetableItemIds ?? []) {
    if (timetableItemId) {
      await deleteTimetableItemById(timetableItemId, dispatch, addDeletedTimetableItemIds);
    }
  }
  state.timetableItemIdByNgeId.delete(trainrunId);
};

const storeRoundTrip = async (
  dispatch: AppDispatch,
  forwardId: TrainScheduleId | PacedTrainId,
  returnId?: TrainScheduleId | PacedTrainId
) => {
  if (isPacedTrainId(forwardId)) {
    let roundTrips;
    if (returnId) {
      if (!isPacedTrainId(returnId)) {
        throw new Error('Type mismatch: forward is PacedTrain but return is not');
      }
      roundTrips = {
        round_trips: [
          [
            extractEditoastIdFromPacedTrainId(forwardId),
            extractEditoastIdFromPacedTrainId(returnId),
          ],
        ],
      };
    } else {
      roundTrips = {
        one_ways: [extractEditoastIdFromPacedTrainId(forwardId)],
      };
    }
    await dispatch(
      osrdEditoastApi.endpoints.postRoundTripsPacedTrains.initiate({
        roundTrips,
      })
    ).unwrap();
  } else {
    let roundTrips;
    if (returnId) {
      if (!isTrainScheduleId(returnId)) {
        throw new Error('Type mismatch: forward is TrainSchedule but return is not');
      }
      roundTrips = {
        round_trips: [
          [
            extractEditoastIdFromTrainScheduleId(forwardId),
            extractEditoastIdFromTrainScheduleId(returnId),
          ],
        ],
      };
    } else {
      roundTrips = {
        one_ways: [extractEditoastIdFromTrainScheduleId(forwardId)],
      };
    }
    await dispatch(
      osrdEditoastApi.endpoints.postRoundTripsTrainSchedules.initiate({
        roundTrips,
      })
    ).unwrap();
  }
};

/**
 * Handle the following cases:
 * - if the TimetableItem is initially a PacedTrain and the frequency is still PacedTrain (`paced` time window is keep identical and interval to corresponding TrainrunFrequency)
 * - if the TimetableItem is initially a PacedTrain and the frequency is now changed to TrainSchedule (`paced` set to undefined)
 * - if the TimetableItem is initially a TrainSchedule and the frequency is still TrainSchedule (`paced` set to undefined)
 * - if the TimetableItem is initially a TrainSchedule and the frequency is now changed to PacedTrain (`paced` time window set to 2 hours and interval to corresponding TrainrunFrequency)
 * Also handles conversion from round trips to one way trips and the inverse.
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
  const timetableItemIds = state.timetableItemIdByNgeId.get(trainrun.id)!;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...timetableItemBase } = oldForwardTimetableItem;

  const category = getTrainCategoryFromTrainrunCategoryId(
    state.trainrunCategories,
    trainrun.categoryId
  );

  const newForwardTimetableItem = {
    ...timetableItemBase,
    train_name: trainrun.name,
    labels,
    // Reset margins because they contain references to path items
    margins: undefined,
    paced: undefined,
    exceptions: undefined,
    category,
    ...forwardPathAndSchedule,
  };

  const paced = createPacedAttributesFromTrainrun(trainrun, netzgrafikDto);

  let newForwardPacedTrain: PacedTrain | undefined;
  // Track the updated forward item to preserve its (potentially new) id when changing type

  let updatedForwardTrainId: TrainScheduleId | PacedTrainId;
  if (!paced) {
    const updatedTrainSchedule = await storeTrainSchedule(
      oldForwardTimetableItem.id,
      newForwardTimetableItem,
      timetableId,
      dispatch,
      addUpsertedTimetableItems,
      addDeletedTimetableItemIds
    );
    updatedForwardTrainId = updatedTrainSchedule.id;
  } else {
    if (isPacedTrainResponseWithPacedTrainId(oldForwardTimetableItem)) {
      paced.time_window = oldForwardTimetableItem.paced.time_window;
    }
    const newForwardPacedTrainBase = {
      ...newForwardTimetableItem,
      paced,
    };
    newForwardPacedTrain = {
      ...newForwardPacedTrainBase,
      exceptions: isPacedTrainResponseWithPacedTrainId(oldForwardTimetableItem)
        ? checkChangeGroups(newForwardPacedTrainBase, oldForwardTimetableItem.exceptions)
        : [],
    };
    const updatedPacedTrain = await storePacedTrain(
      oldForwardTimetableItem.id,
      newForwardPacedTrain,
      timetableId,
      dispatch,
      addUpsertedTimetableItems,
      addDeletedTimetableItemIds
    );
    updatedForwardTrainId = updatedPacedTrain.id;
  }

  if (trainrun.direction === 'one_way') {
    if (timetableItemIds[1]) {
      // NGE always selects the forward trip by default when going from round trip to one way trip,
      // thus the trip that needs to be deleted is always the return trip
      await storeRoundTrip(dispatch, updatedForwardTrainId);
      await deleteTimetableItemById(timetableItemIds[1], dispatch, addDeletedTimetableItemIds);
    }

    const forwardId: TimetableItemId = updatedForwardTrainId;
    state.timetableItemIdByNgeId.set(trainrun.id, [forwardId, null]);
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

  if (timetableItemIds[1]) {
    // update return if already present
    if (newForwardPacedTrain) {
      const updatedReturnPacedTrain = {
        ...newForwardPacedTrain,
        ...returnPathAndSchedule,
      };
      newReturnTimetableItem = await storePacedTrain(
        timetableItemIds[1],
        updatedReturnPacedTrain,
        timetableId,
        dispatch,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds
      );
    } else {
      const updatedReturnTrainSchedule = {
        ...newForwardTimetableItem,
        ...returnPathAndSchedule,
      };
      newReturnTimetableItem = await storeTrainSchedule(
        timetableItemIds[1],
        updatedReturnTrainSchedule,
        timetableId,
        dispatch,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds
      );
    }
  } else {
    // otherwise create return
    if (newForwardPacedTrain) {
      if (!isPacedTrainId(oldForwardTimetableItem.id)) {
        throw new Error(
          'Conversion from one way to round trip and train schedule to paced train at the same time'
        );
      }
      const returnPacedTrain = {
        ...newForwardPacedTrain,
        ...returnPathAndSchedule,
      };

      newReturnTimetableItem = await createPacedTrain(dispatch, timetableId, returnPacedTrain);
    } else {
      if (isPacedTrainId(oldForwardTimetableItem.id)) {
        throw new Error(
          'Conversion from one way to round trip and paced train to train schedule at the same time'
        );
      }
      const returnTrainSchedule = {
        ...newForwardTimetableItem,
        ...returnPathAndSchedule,
      };

      newReturnTimetableItem = await createTrainSchedule(
        dispatch,
        timetableId,
        returnTrainSchedule
      );
    }

    addUpsertedTimetableItems([newReturnTimetableItem]);
  }

  // Ensure the round-trip association is kept after updates/conversions
  await storeRoundTrip(dispatch, updatedForwardTrainId, newReturnTimetableItem.id);

  state.timetableItemIdByNgeId.set(trainrun.id, [updatedForwardTrainId, newReturnTimetableItem.id]);
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

const getNoteLabelTextsFromIds = (netzgrafikDto: NetzgrafikDto, labelIds: number[]): string[] =>
  labelIds
    .map((id) => netzgrafikDto.labels.find((l) => l.id === id)?.label)
    .filter((l) => l !== undefined);

const castNgeNoteToOsrd = (note: FreeFloatingTextDto, netzgrafikDto: NetzgrafikDto) => ({
  x: Math.round(note.x),
  y: Math.round(note.y),
  title: note.title,
  text: note.text,
  labels: getNoteLabelTextsFromIds(netzgrafikDto, note.labelIds),
});

export const createMacroNote = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  netzgrafikDto: NetzgrafikDto,
  note: FreeFloatingTextDto
) => {
  const response = await dispatch(
    osrdEditoastApi.endpoints.postProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotes.initiate(
      {
        projectId: state.projectId,
        studyId: state.studyId,
        scenarioId: state.scenarioId,
        macroNoteBatchForm: {
          macro_notes: [castNgeNoteToOsrd(note, netzgrafikDto)],
        },
      }
    )
  ).unwrap();

  const createdNote = response.macro_notes[0];
  state.setDbIdForNote(note.id, createdNote.id);
};

export const updateMacroNote = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  netzgrafikDto: NetzgrafikDto,
  note: FreeFloatingTextDto
) => {
  const dbId = state.getDbIdForNote(note.id);
  if (!dbId) throw new Error(`Note ${note.id} is not saved in the DB`);

  await dispatch(
    osrdEditoastApi.endpoints.putProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteId.initiate(
      {
        projectId: state.projectId,
        studyId: state.studyId,
        scenarioId: state.scenarioId,
        noteId: dbId,
        macroNoteForm: castNgeNoteToOsrd(note, netzgrafikDto),
      }
    )
  ).unwrap();
};

export const deleteMacroNote = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  ngeId: number
) => {
  const noteId = state.getDbIdForNote(ngeId);
  if (!noteId) throw new Error(`Note ${ngeId} is not saved in the DB`);

  await dispatch(
    osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteId.initiate(
      {
        projectId: state.projectId,
        studyId: state.studyId,
        scenarioId: state.scenarioId,
        noteId: noteId,
      }
    )
  ).unwrap();

  state.removeNoteMapping(ngeId);
};

const handleNoteOperation = async ({
  type,
  netzgrafikDto,
  note,
  state,
  dispatch,
}: {
  type: NGEEvent['type'];
  netzgrafikDto: NetzgrafikDto;
  note: FreeFloatingTextDto;
  state: MacroEditorState;
  dispatch: AppDispatch;
}) => {
  switch (type) {
    case 'create': {
      await createMacroNote(state, dispatch, netzgrafikDto, note);
      break;
    }
    case 'update': {
      await updateMacroNote(state, dispatch, netzgrafikDto, note);
      break;
    }
    case 'delete': {
      await deleteMacroNote(state, dispatch, note.id);
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
  position_x: Math.round(node.positionX),
  position_y: Math.round(node.positionY),
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

export const handleOperation = async ({
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
    case 'note':
      await handleNoteOperation({
        type,
        netzgrafikDto,
        note: event.note,
        state,
        dispatch,
      });
      break;
    default:
      break;
  }
};

export const relabelDuplicateTrigrams = (nodes: NodeDto[]): NodeDto[] => {
  const trigramsToIds = new Map<string, number[]>();
  for (const node of nodes) {
    if (!trigramsToIds.has(node.betriebspunktName)) trigramsToIds.set(node.betriebspunktName, []);
    trigramsToIds.get(node.betriebspunktName)!.push(node.id);
  }

  return nodes.map((node) => {
    const trigramIds = trigramsToIds.get(node.betriebspunktName)!;
    if (trigramIds.length == 1) return node;
    const idIndex = trigramIds.findIndex((id) => id === node.id);
    const newTrigram = `${node.betriebspunktName}-${idIndex + 1}`;
    return {
      ...node,
      betriebspunktName: newTrigram,
    };
  });
};

export const convertNgeDtoToOsrd = (dto: NetzgrafikDto) => {
  const dedupNodes = relabelDuplicateTrigrams(dto.nodes);
  const macroNodes: MacroNodeForm[] = [];
  for (const node of dedupNodes) {
    macroNodes.push({
      ...castNgeNode(node, dto.labels),
      path_item_key: `trigram:${node.betriebspunktName}`,
    });
  }

  const trainSchedules: TrainScheduleFromJson[] = [];
  const pacedTrains: PacedTrainFromJson[] = [];
  const pacedTrainsRoundTrips: ([number, number] | [number, null])[] = [];
  const trainSchedulesRoundTrips: ([number, number] | [number, null])[] = [];
  for (const trainrun of dto.trainruns) {
    const groupedTrainrunSections = getTrainrunSectionsByTrainrunId(dto, trainrun.id);
    const labels = getTrainrunLabels(dto, trainrun);
    const category = dto.metadata.trainrunCategories.find((cat) => cat.id === trainrun.categoryId);
    const directions =
      trainrun.direction === 'one_way'
        ? [TRAINRUN_DIRECTIONS.FORWARD]
        : [TRAINRUN_DIRECTIONS.FORWARD, TRAINRUN_DIRECTIONS.BACKWARD];
    for (const [index, trainrunSections] of groupedTrainrunSections.entries()) {
      for (const direction of directions) {
        const pathAndSchedule = generatePathAndSchedule(
          trainrunSections,
          dedupNodes,
          undefined,
          direction
        );
        const isTrainSplit = groupedTrainrunSections.length > 1;
        const commonProps = {
          train_name: isTrainSplit ? `${trainrun.name}-${index + 1}` : trainrun.name,
          labels,
          category: category?.name,
          ...pathAndSchedule,
        };
        const paced = createPacedAttributesFromTrainrun(trainrun, dto);
        if (paced) {
          pacedTrains.push({
            ...DEFAULT_PACED_TRAIN_PAYLOAD,
            ...commonProps,
            paced,
          });
          if (direction === TRAINRUN_DIRECTIONS.FORWARD) {
            pacedTrainsRoundTrips.push([
              pacedTrains.length - 1,
              trainrun.direction === 'one_way' ? null : pacedTrains.length,
            ]);
          }
        } else {
          trainSchedules.push({
            ...DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
            ...commonProps,
          });
          if (direction === TRAINRUN_DIRECTIONS.FORWARD) {
            trainSchedulesRoundTrips.push([
              trainSchedules.length - 1,
              trainrun.direction === 'one_way' ? null : trainSchedules.length,
            ]);
          }
        }
      }
    }
  }

  return {
    macro_nodes: macroNodes,
    paced_trains: pacedTrains,
    train_schedules: trainSchedules,
    round_trips: { train_schedules: trainSchedulesRoundTrips, paced_trains: pacedTrainsRoundTrips },
  };
};
