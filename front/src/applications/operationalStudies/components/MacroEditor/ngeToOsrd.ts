import { compact, uniq } from 'lodash';

import {
  osrdEditoastApi,
  type SearchResultItemOperationalPoint,
  type TrainScheduleBase,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';
import { formatToIsoDate } from 'utils/date';
import { calculateTimeDifferenceInSeconds, formatDurationAsISO8601 } from 'utils/timeManipulation';

import nodeStore from './nodeStore';
import { DEFAULT_TRAINRUN_FREQUENCIES, DEFAULT_TRAINRUN_FREQUENCY } from './osrdToNge';
import type {
  NetzgrafikDto,
  NGEEvent,
  TrainrunSectionDto,
  NodeDto,
  TimeLockDto,
  TrainrunDto,
  LabelDto,
} from '../NGE/types';

const createdTrainrun = new Map<number, number>();

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
  // eslint-disable-next-line no-restricted-syntax
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

const DEFAULT_PAYLOAD: Pick<TrainScheduleBase, 'constraint_distribution' | 'rolling_stock_name'> = {
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

const formatDateDifference = (start: Date, stop: Date) =>
  formatDurationAsISO8601(calculateTimeDifferenceInSeconds(start, stop));

const createTrainSchedulePayload = async ({
  trainrunSections,
  nodes,
  trainrun,
  infraId,
  dispatch,
  labels,
  oldStartDate,
  trainSchedule,
}: {
  trainrunSections: TrainrunSectionDto[];
  nodes: NodeDto[];
  trainrun: TrainrunDto;
  infraId: number;
  dispatch: AppDispatch;
  labels: LabelDto[];
  oldStartDate: Date;
  trainSchedule?: TrainScheduleBase;
}) => {
  // TODO: check that the trainrunSections format is still compatible
  const pathPromise = trainrunSections.map(async (section, index) => {
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

  const path = await Promise.all(pathPromise);

  let trainrunLabels = trainrun.labelIds.map(
    (labelId) => labels.find((label) => label.id === labelId)?.label
  );

  if (trainrun.frequencyId !== DEFAULT_TRAINRUN_FREQUENCY.id) {
    const trainrunFrequency = DEFAULT_TRAINRUN_FREQUENCIES.find(
      (frequency) => frequency.id === trainrun.frequencyId
    );
    trainrunLabels.push(`frequency::${trainrunFrequency?.frequency}`);
  }

  const trainScheduleLabels =
    trainSchedule?.labels?.filter((label) => label.match(/^frequency::(?!30$|60$|120$)\d+$/)) || [];

  trainrunLabels = uniq([...trainrunLabels, ...trainScheduleLabels]);

  // The departure time of the first section is guaranteed to be non-null
  const startTimeLock = trainrunSections[0].sourceDeparture;
  const startDate = new Date(oldStartDate);
  startDate.setMinutes(startTimeLock.time!, 0, 0);

  const schedule = trainrunSections.flatMap((section, index) => {
    const nextSection = trainrunSections[index + 1];

    // TODO: extract isNonStopTransit from transitions
    let arrival = getTimeLockDate(section.targetArrival, startTimeLock, startDate);
    const departure = nextSection
      ? getTimeLockDate(nextSection.sourceDeparture, startTimeLock, startDate)
      : null;
    if (!arrival && !departure) {
      return [];
    }

    // If missing arrival time, default to a zero stop duration
    arrival = arrival || departure!;

    return {
      at: `${section.targetNodeId}-${index + 1}`,
      arrival: formatDateDifference(arrival, startDate),
      stop_for: departure ? formatDateDifference(departure, arrival) : null,
    };
  });

  return {
    train_name: trainrun.name,
    labels: compact(trainrunLabels),
    path: path.flat(),
    start_time: formatToIsoDate(startDate),
    schedule,
  };
};

const handleUpdateTrainSchedule = async ({
  netzgrafikDto,
  trainrun,
  dispatch,
  infraId,
  addUpsertedTrainSchedules,
}: {
  netzgrafikDto: NetzgrafikDto;
  trainrun: TrainrunDto;
  dispatch: AppDispatch;
  infraId: number;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
}) => {
  const { nodes, labels } = netzgrafikDto;
  const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  const trainrunIdToUpdate = createdTrainrun.get(trainrun.id) || trainrun.id;
  const trainSchedule = await dispatch(
    osrdEditoastApi.endpoints.getTrainScheduleById.initiate({
      id: trainrunIdToUpdate,
    })
  ).unwrap();
  const startDate = new Date(trainSchedule.start_time);
  const trainSchedulePayload = await createTrainSchedulePayload({
    trainrunSections: trainrunSectionsByTrainrunId,
    nodes,
    trainrun,
    infraId,
    dispatch,
    labels,
    oldStartDate: startDate,
    trainSchedule,
  });
  const newTrainSchedule = await dispatch(
    osrdEditoastApi.endpoints.putTrainScheduleById.initiate({
      id: trainrunIdToUpdate,
      trainScheduleForm: {
        ...trainSchedule,
        ...trainSchedulePayload,
        // Reset margins because they contain references to path items
        margins: undefined,
      },
    })
  ).unwrap();
  addUpsertedTrainSchedules([newTrainSchedule]);
};

const handleTrainrunOperation = async ({
  type,
  trainrun,
  dispatch,
  infraId,
  timeTableId,
  netzgrafikDto,
  addUpsertedTrainSchedules,
  addDeletedTrainIds,
}: {
  type: NGEEvent['type'];
  trainrun: TrainrunDto;
  dispatch: AppDispatch;
  infraId: number;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  addDeletedTrainIds: (trainIds: number[]) => void;
}) => {
  const { nodes, labels } = netzgrafikDto;
  switch (type) {
    case 'create': {
      const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(
        netzgrafikDto,
        trainrun.id
      );
      const startDate = new Date();
      const newTrainSchedules = await dispatch(
        osrdEditoastApi.endpoints.postTimetableByIdTrainSchedule.initiate({
          id: timeTableId,
          body: [
            {
              ...DEFAULT_PAYLOAD,
              ...(await createTrainSchedulePayload({
                trainrunSections: trainrunSectionsByTrainrunId,
                nodes,
                trainrun,
                infraId,
                dispatch,
                labels,
                oldStartDate: startDate,
              })),
            },
          ],
        })
      ).unwrap();
      createdTrainrun.set(trainrun.id, newTrainSchedules[0].id);
      addUpsertedTrainSchedules(newTrainSchedules);
      break;
    }
    case 'delete': {
      const trainrunIdToDelete = createdTrainrun.get(trainrun.id) || trainrun.id;
      await dispatch(
        osrdEditoastApi.endpoints.deleteTrainSchedule.initiate({
          body: { ids: [trainrunIdToDelete] },
        })
      ).unwrap();
      createdTrainrun.delete(trainrun.id);
      addDeletedTrainIds([trainrunIdToDelete]);
      break;
    }
    case 'update': {
      await handleUpdateTrainSchedule({
        netzgrafikDto,
        trainrun,
        dispatch,
        infraId,
        addUpsertedTrainSchedules,
      });
      break;
    }
    default:
      break;
  }
};

const handleUpdateNode = (timeTableId: number, node: NodeDto) => {
  const { betriebspunktName: trigram, positionX, positionY } = node;
  nodeStore.set(timeTableId, { trigram, positionX, positionY });
};

const handleNodeOperation = ({
  type,
  node,
  timeTableId,
}: {
  type: NGEEvent['type'];
  node: NodeDto;
  timeTableId: number;
}) => {
  switch (type) {
    case 'create':
    case 'update': {
      handleUpdateNode(timeTableId, node);
      break;
    }
    case 'delete': {
      nodeStore.delete(timeTableId, node.betriebspunktName);
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
  addUpsertedTrainSchedules,
}: {
  type: NGEEvent['type'];
  label: LabelDto;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
  infraId: number;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
}) => {
  const { trainruns } = netzgrafikDto;
  switch (type) {
    case 'update': {
      const trainrunUpdateLabels = trainruns.filter((trainrun) =>
        trainrun.labelIds.includes(label.id)
      );
      trainrunUpdateLabels.forEach(async (trainrun) => {
        await handleUpdateTrainSchedule({
          netzgrafikDto,
          trainrun,
          dispatch,
          infraId,
          addUpsertedTrainSchedules,
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
  infraId,
  timeTableId,
  netzgrafikDto,
  addUpsertedTrainSchedules,
  addDeletedTrainIds,
}: {
  event: NGEEvent;
  dispatch: AppDispatch;
  infraId: number;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  addDeletedTrainIds: (trainIds: number[]) => void;
}) => {
  const { type } = event;
  const { trainruns } = netzgrafikDto;
  switch (event.objectType) {
    case 'node':
      handleNodeOperation({ type, node: event.node, timeTableId });
      break;
    case 'trainrun': {
      const trainrun = trainruns.find((tr) => tr.id === event.trainrun.id)!;
      await handleTrainrunOperation({
        type,
        trainrun,
        dispatch,
        infraId,
        timeTableId,
        netzgrafikDto,
        addUpsertedTrainSchedules,
        addDeletedTrainIds,
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
        addUpsertedTrainSchedules,
      });
      break;
    default:
      break;
  }
};

export default handleOperation;
