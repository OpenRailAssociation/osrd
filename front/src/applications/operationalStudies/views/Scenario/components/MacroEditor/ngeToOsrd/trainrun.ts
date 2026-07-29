import type {
  NetzgrafikDto,
  Operation,
  TrainrunSectionDto,
  NodeDto,
  TimeLockDto,
  TrainrunDto,
} from '@osrd-project/netzgrafik-frontend';
import { compact, uniq } from 'lodash';

import {
  type TrainSchedule,
  type PathItemLocation,
  type TimetableType,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { parseStartTime } from 'modules/trainSchedule/helpers/formatTrainScheduleWithDetails';
import { getDefaultPacedTrainTimeWindow } from 'modules/trainSchedule/helpers/pacedTrain';
import {
  createTrainSchedules,
  deleteTrainSchedules,
  fetchTrainSchedule,
  storeTrainSchedule,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import { updateSelectedTrain } from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { Duration, startTimeToMs, type StartTime } from 'utils/duration';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { checkChangeGroups } from '../../ManageTrainSchedule/helpers/buildPacedTrainException';
import { DEFAULT_TRAIN_SCHEDULE_PAYLOAD, TRAINRUN_DIRECTIONS } from '../consts';
import MacroEditorState from '../MacroEditorState';
import {
  fetchStationSecondaryCodeCountryCode,
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
    // TODO : handle this case in xml import refacto
    const { main_code, secondary_code, country_code } = MacroEditorState.decodeDomesticReference(
      node.betriebspunktName
    );
    pathItemLocation = {
      type: 'operational_point_part_reference',
      operational_point: { main_code, secondary_code, type: 'domestic', country_code },
      local_track_name: null,
    };
  }
  return {
    location: pathItemLocation,
    id: `${node.id}-${index}`,
  };
};

const getTimeLockTimeOffset = (
  timeLock: TimeLockDto,
  startTimeLock: TimeLockDto
): Duration | null => {
  if (
    timeLock.time === null ||
    timeLock.consecutiveTime === null ||
    startTimeLock.consecutiveTime === null
  )
    return null;
  const offset = new Duration({
    minutes: timeLock.consecutiveTime - startTimeLock.consecutiveTime,
  });
  return offset;
};

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
 * Calculate the start time of a trainrun and return it as either a Date for calendar timetable
 * or a Duration from the start of the timetable for hourly ones, clamping paced train start times to their intervals for hourly timetables.
 */
const calculateStartTime = (
  trainrunSections: TrainrunSectionDto[],
  baseStartTime: StartTime,
  trainrunDirection: TRAINRUN_DIRECTIONS = TRAINRUN_DIRECTIONS.FORWARD,
  paced: TrainSchedule['paced']
): StartTime => {
  // The departure time of the first section is guaranteed to be non-null
  const startTimeLock =
    trainrunDirection === TRAINRUN_DIRECTIONS.BACKWARD
      ? trainrunSections[0].targetDeparture
      : trainrunSections[0].sourceDeparture;

  if (baseStartTime instanceof Duration) {
    const startTime = new Duration({
      hours: Math.floor(baseStartTime.total('hour')),
      minutes: startTimeLock.time!,
    });
    if (!paced) return startTime;
    /*In an hourly timetable the start time is an offset from the timetable start, and the
     * database enforces `0 <= start_time < interval <= time_window` on every paced train of an
     * hourly train schedule set. NGE only knows a minute within the hour, so a trainrun can
     * land past its own interval — typically the return trip of a round trip departing at :59
     * while the interval is 30 min.
     *
     * Taking the offset modulo the interval designates the very same occurrence: with a train
     * every 30 min, departing at :59 and departing at :29 are the same train.*/
    const intervalMs = Duration.parse(paced.interval).ms;
    return new Duration({ milliseconds: startTime.ms % intervalMs });
  }

  const startDate = new Date(baseStartTime);
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

    let arrival = getTimeLockTimeOffset(arrivalTimeLock, trainrunStartTimeLock);
    let departure: Duration | null = null;
    if (nextSection) {
      const nextDepartureTimeLock = isForward
        ? nextSection.sourceDeparture
        : nextSection.targetDeparture;
      departure = getTimeLockTimeOffset(nextDepartureTimeLock, trainrunStartTimeLock);
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

    let stop_for: Duration | null = null;
    if (isStopTransit) stop_for = departure ? departure.sub(arrival) : Duration.zero;

    return {
      at: `${toNodeId}-${index + 1}`,
      arrival: arrival.toISOString(),
      stop_for: stop_for?.toISOString() ?? null,
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

export const defaultBaseStartTime = (timetableType: TimetableType): StartTime =>
  timetableType === 'HOURLY' ? Duration.zero : new Date();

/**
 * Generate start time, path and schedule from a trainrun. If the trainrun is
 * backward, the sections are reversed.
 */
export const generatePathAndSchedule = (
  trainrunSections: TrainrunSectionDto[],
  nodes: NodeDto[],
  baseStartTime: StartTime,
  trainrunDirection: TRAINRUN_DIRECTIONS = TRAINRUN_DIRECTIONS.FORWARD,
  paced: TrainSchedule['paced'],
  state?: MacroEditorState
) => {
  let sections = trainrunSections;
  if (trainrunDirection === TRAINRUN_DIRECTIONS.BACKWARD) {
    sections = [...trainrunSections].reverse();
  }

  const startTime = calculateStartTime(sections, baseStartTime, trainrunDirection, paced);
  const path = generatePath(sections, nodes, trainrunDirection, state);
  const schedule = generateSchedule(sections, nodes, trainrunDirection);
  return { start_time: startTimeToMs(startTime), path, schedule };
};

// Populate secondary code when user did not specified one
// so we can still find operational points when created from NGE
const populateSecondaryCodesInPath = async (
  path: TrainSchedule['path'],
  infraId: number,
  dispatch: AppDispatch
) => {
  const promises = path.map(async (pathItem) => {
    if (
      pathItem.location.type === 'track_offset' ||
      pathItem.location.operational_point.type !== 'domestic' ||
      (pathItem.location.operational_point.country_code !== '??' &&
        pathItem.location.operational_point.secondary_code)
    ) {
      return;
    }
    const { secondary_code, country_code } = await fetchStationSecondaryCodeCountryCode(
      pathItem.location.operational_point,
      infraId,
      dispatch
    );
    if (secondary_code) pathItem.location.operational_point.secondary_code = secondary_code;
    if (country_code) pathItem.location.operational_point.country_code = country_code;
  });

  await Promise.all(promises);
};

export const createPacedAttributesFromTrainrun = (
  trainrun: TrainrunDto,
  dto: NetzgrafikDto,
  defaultTimeWindow: Duration
): TrainSchedule['paced'] => {
  const freq = getFrequencyFromFrequencyId(dto.metadata.trainrunFrequencies, trainrun.frequencyId);
  const interval = new Duration({ minutes: freq.frequency });
  if (interval >= new Duration({ hours: 24 })) {
    // We use a 24-hour interval to indicate that a train isn't paced
    return null;
  }
  return {
    interval: interval.toISOString(),
    time_window: defaultTimeWindow.toISOString(),
    exceptions: [],
  };
};

/**
 * By default (in NGE code), a newly created trainrun has a frequencyId of 3,
 * which is equivalent to a PacedTrain (paced.interval = 60min).
 * No UniqueTrain can be created here, but only updated from an existing PacedTrain.
 */
const handleCreateTrainSchedule = async (
  netzgrafikDto: NetzgrafikDto,
  trainrun: TrainrunDto,
  trainScheduleSetId: number,
  infraId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void
) => {
  const trainrunSections = getContinuousTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const labels = getTrainrunLabels(netzgrafikDto, trainrun);

  const baseStartTime = defaultBaseStartTime(state.timetableType);

  const paced = createPacedAttributesFromTrainrun(
    trainrun,
    netzgrafikDto,
    getDefaultPacedTrainTimeWindow(state.timetableType)
  );

  const pathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    baseStartTime,
    TRAINRUN_DIRECTIONS.FORWARD,
    paced,
    state
  );

  const returnPathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    baseStartTime,
    TRAINRUN_DIRECTIONS.BACKWARD,
    paced,
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

  const forwardTrip: TrainSchedule = {
    ...DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
    paced,
    train_name: trainrun.name,
    labels,
    category,
    ...pathAndSchedule,
  };

  const returnTrip =
    trainrun.direction === 'round_trip'
      ? {
          ...forwardTrip,
          ...returnPathAndSchedule,
        }
      : undefined;

  const trainSchedulesToCreate = returnTrip ? [forwardTrip, returnTrip] : [forwardTrip];

  const newTrainSchedules: TrainScheduleResponse[] = await createTrainSchedules(
    dispatch,
    trainScheduleSetId,
    trainSchedulesToCreate
  );
  if (newTrainSchedules.length !== trainSchedulesToCreate.length) {
    throw new Error('Failed to create train schedule(s)');
  }
  addUpsertedTrainSchedules(newTrainSchedules);
  dispatch(
    updateSelectedTrain({
      id: formatEditoastIdToTrainScheduleId(newTrainSchedules[0].id),
      by: 'timetable',
    })
  );

  const newTrainIds: [number, number | null] = [
    newTrainSchedules[0].id,
    newTrainSchedules.at(1)?.id ?? null,
  ];
  state.trainScheduleIdByNgeId.set(trainrun.id, newTrainIds);
  storeRoundTrip(dispatch, newTrainIds[0], newTrainIds[1] ?? undefined);
};

const deleteTrainScheduleById = async (
  trainScheduleId: number,
  dispatch: AppDispatch,
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void
) => {
  await deleteTrainSchedules(dispatch, [trainScheduleId]);

  addDeletedTrainScheduleIds([trainScheduleId]);
};

const handleDeleteTrainSchedule = async (
  trainrunId: number,
  state: MacroEditorState,
  dispatch: AppDispatch,
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void
) => {
  const trainScheduleIds = state.trainScheduleIdByNgeId.get(trainrunId);
  for (const trainScheduleId of trainScheduleIds ?? []) {
    if (trainScheduleId) {
      await deleteTrainScheduleById(trainScheduleId, dispatch, addDeletedTrainScheduleIds);
    }
  }
  state.trainScheduleIdByNgeId.delete(trainrunId);
};

/**
 * Handle the following cases:
 * - if the TrainSchedule is initially a PacedTrain and the frequency is still PacedTrain (`paced` time window is keep identical and interval to corresponding TrainrunFrequency)
 * - if the TrainSchedule is initially a PacedTrain and the frequency is now changed to UniqueTrain (`paced` set to undefined)
 * - if the TrainSchedule is initially a UniqueTrain and the frequency is still UniqueTrain (`paced` set to undefined)
 * - if the TrainSchedule is initially a UniqueTrain and the frequency is now changed to PacedTrain (`paced` time window set to 2 hours and interval to corresponding TrainrunFrequency)
 * Also handles conversion from round trips to one way trips and the inverse.
 */
export const handleUpdateTrainSchedule = async ({
  netzgrafikDto,
  trainrun,
  trainScheduleSetId,
  infraId,
  state,
  dispatch,
  addUpsertedTrainSchedules,
  addDeletedTrainScheduleIds,
}: {
  netzgrafikDto: NetzgrafikDto;
  trainrun: TrainrunDto;
  infraId: number;
  trainScheduleSetId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void;
}) => {
  const trainScheduleIds = state.trainScheduleIdByNgeId.get(trainrun.id);
  if (!trainScheduleIds) return;
  const oldForwardTrainSchedule = await fetchTrainSchedule(trainScheduleIds[0], dispatch);
  const trainrunSections = getContinuousTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const labels = getTrainrunLabels(netzgrafikDto, trainrun);
  const baseStartTime = parseStartTime(oldForwardTrainSchedule.start_time, state.timetableType);
  const paced = createPacedAttributesFromTrainrun(
    trainrun,
    netzgrafikDto,
    getDefaultPacedTrainTimeWindow(state.timetableType)
  );
  const forwardPathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    baseStartTime,
    TRAINRUN_DIRECTIONS.FORWARD,
    paced,
    state
  );
  await populateSecondaryCodesInPath(forwardPathAndSchedule.path, infraId, dispatch);

  const { id: _id, ...trainScheduleBase } = oldForwardTrainSchedule;

  const category = getTrainCategoryFromTrainrunCategoryId(
    state.trainrunCategories,
    trainrun.categoryId
  );

  const newForwardTrainBase: Omit<TrainScheduleResponse, 'id'> = {
    ...trainScheduleBase,
    train_name: trainrun.name,
    labels,
    // Reset margins and power restrictions because they contain references to path items
    margins: undefined,
    power_restrictions: undefined,
    paced,
    category,
    ...forwardPathAndSchedule,
  };

  if (paced && oldForwardTrainSchedule.paced) {
    paced.time_window = oldForwardTrainSchedule.paced.time_window;
    paced.exceptions = checkChangeGroups(
      newForwardTrainBase,
      paced,
      oldForwardTrainSchedule.paced.exceptions
    ).exceptions;
    newForwardTrainBase.paced = paced;
  }

  const newForwardTrainSchedule = await storeTrainSchedule(
    oldForwardTrainSchedule.id,
    newForwardTrainBase,
    dispatch,
    addUpsertedTrainSchedules
  );

  if (trainrun.direction === 'one_way') {
    if (trainScheduleIds[1]) {
      // NGE always selects the forward trip by default when going from round trip to one way trip,
      // thus the trip that needs to be deleted is always the return trip
      await storeRoundTrip(dispatch, newForwardTrainSchedule.id);
      await deleteTrainScheduleById(trainScheduleIds[1], dispatch, addDeletedTrainScheduleIds);
    }

    state.trainScheduleIdByNgeId.set(trainrun.id, [newForwardTrainSchedule.id, null]);
    return;
  }

  const returnPathAndSchedule = generatePathAndSchedule(
    trainrunSections,
    netzgrafikDto.nodes,
    baseStartTime,
    TRAINRUN_DIRECTIONS.BACKWARD,
    paced,
    state
  );

  await populateSecondaryCodesInPath(returnPathAndSchedule.path, infraId, dispatch);

  let newReturnTrainSchedule: TrainScheduleResponse;
  const returnPaced: TrainSchedule['paced'] = paced ? { ...paced, exceptions: [] } : null;

  if (trainScheduleIds[1]) {
    // update return if already present
    const oldReturnTrainSchedule = await fetchTrainSchedule(trainScheduleIds[1], dispatch);
    const { id: _return_id, ...oldReturnTrainBase } = oldReturnTrainSchedule;
    const newReturnTrainBase: Omit<TrainScheduleResponse, 'id'> = {
      ...oldReturnTrainBase,
      train_name: trainrun.name,
      labels,
      // Reset margins and power restrictions because they contain references to path items
      margins: undefined,
      power_restrictions: undefined,
      paced: returnPaced,
      category,
      ...returnPathAndSchedule,
    };

    if (returnPaced && oldReturnTrainSchedule.paced) {
      returnPaced.time_window = oldReturnTrainSchedule.paced.time_window;
      returnPaced.exceptions = checkChangeGroups(
        newReturnTrainBase,
        returnPaced,
        oldReturnTrainSchedule.paced.exceptions
      ).exceptions;
      newReturnTrainBase.paced = returnPaced;
    }

    newReturnTrainSchedule = await storeTrainSchedule(
      oldReturnTrainSchedule.id,
      newReturnTrainBase,
      dispatch,
      addUpsertedTrainSchedules
    );
  } else {
    // otherwise create return

    // Remove train_schedule_set_id before creating train schedule as we don't want to pass it in the payload
    const {
      train_schedule_set_id: _trainScheduleSetId,
      ...trainScheduleWithoutTrainScheduleSetId
    } = newForwardTrainBase;

    const returnTrainSchedule: TrainSchedule = {
      ...trainScheduleWithoutTrainScheduleSetId,
      ...returnPathAndSchedule,
      paced: returnPaced,
    };

    newReturnTrainSchedule = (
      await createTrainSchedules(dispatch, trainScheduleSetId, [returnTrainSchedule])
    )[0];

    addUpsertedTrainSchedules([newReturnTrainSchedule]);
  }

  // Ensure the round-trip association is kept after updates/conversions
  await storeRoundTrip(dispatch, newForwardTrainSchedule.id, newReturnTrainSchedule.id);

  state.trainScheduleIdByNgeId.set(trainrun.id, [
    newForwardTrainSchedule.id,
    newReturnTrainSchedule.id,
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
  addUpsertedTrainSchedules,
  addDeletedTrainScheduleIds,
}: {
  type: Operation['type'];
  netzgrafikDto: NetzgrafikDto;
  trainrunId: number;
  trainScheduleSetId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void;
}) => {
  const trainrun = netzgrafikDto.trainruns.find((tr) => tr.id === trainrunId);
  switch (type) {
    case 'create': {
      await handleCreateTrainSchedule(
        netzgrafikDto,
        trainrun!,
        trainScheduleSetId,
        infraId,
        state,
        dispatch,
        addUpsertedTrainSchedules
      );
      break;
    }
    case 'update': {
      await handleUpdateTrainSchedule({
        netzgrafikDto,
        trainrun: trainrun!,
        trainScheduleSetId,
        infraId,
        dispatch,
        state,
        addUpsertedTrainSchedules,
        addDeletedTrainScheduleIds,
      });
      break;
    }
    case 'delete': {
      await handleDeleteTrainSchedule(trainrunId, state, dispatch, addDeletedTrainScheduleIds);
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
  addUpsertedTrainSchedules,
  addDeletedTrainScheduleIds,
  node,
}: {
  state: MacroEditorState;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
  infraId: number;
  trainScheduleSetId: number;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void;
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
    await handleUpdateTrainSchedule({
      netzgrafikDto,
      trainrun,
      trainScheduleSetId,
      infraId,
      dispatch,
      state,
      addUpsertedTrainSchedules,
      addDeletedTrainScheduleIds,
    });
  }
};
