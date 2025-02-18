import { compact, uniq } from 'lodash';

import {
  osrdEditoastApi,
  type SearchResultItemOperationalPoint,
  type TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type {
  TimetableItemId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { Duration } from 'utils/duration';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
} from 'utils/trainId';

import { DEFAULT_TRAINRUN_FREQUENCIES, DEFAULT_TRAINRUN_FREQUENCY } from './consts';
import type MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';
import {
  createMacroNode,
  deleteMacroNodeByNgeId,
  trainrunFrequencyFromLabel,
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

const formatDateDifferenceFrom = (start: Date, stop: Date) =>
  Duration.subtractDate(stop, start).toISOString();

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
    trainSchedule?.labels?.filter((label) => trainrunFrequencyFromLabel(label) !== null) || [];

  trainrunLabels = uniq([...trainrunLabels, ...trainScheduleLabels]);

  // The departure time of the first section is guaranteed to be non-null
  const startTimeLock = trainrunSections[0].sourceDeparture;
  const startDate = new Date(oldStartDate);
  startDate.setMinutes(startTimeLock.time!, 0, 0);

  const schedule = trainrunSections.flatMap((section, index) => {
    const nextSection = trainrunSections[index + 1];

    const node = getNodeById(nodes, section.targetNodeId)!;
    const transition = node.transitions.find(
      (tr) => tr.port1Id === section.targetPortId || tr.port2Id === section.targetPortId
    );
    const isNonStopTransit = transition?.isNonStopTransit ?? false;

    // Note that arrival is the time the train arrives at the node
    // and departure is the time the train leaves the node
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
      arrival: formatDateDifferenceFrom(startDate, arrival),
      stop_for:
        departure && !isNonStopTransit ? formatDateDifferenceFrom(arrival, departure) : null,
    };
  });

  return {
    train_name: trainrun.name,
    labels: compact(trainrunLabels),
    path: path.flat(),
    start_time: startDate.toISOString(),
    schedule,
  };
};

const handleUpdateTrainSchedule = async ({
  netzgrafikDto,
  trainrun,
  dispatch,
  infraId,
  addUpsertedTrainSchedules,
  state,
}: {
  netzgrafikDto: NetzgrafikDto;
  trainrun: TrainrunDto;
  dispatch: AppDispatch;
  infraId: number;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  state: MacroEditorState;
}) => {
  const { nodes, labels } = netzgrafikDto;
  const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(netzgrafikDto, trainrun.id);
  // TODO Paced train : Adapt to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10612
  const editoastTrainScheduleIdToUpdate = formatTrainScheduleIdToEditoastTrainId(
    state.trainScheduleIdByNgeId.get(trainrun.id) as TrainScheduleId
  );
  const trainSchedule = await dispatch(
    osrdEditoastApi.endpoints.getTrainScheduleById.initiate({
      id: editoastTrainScheduleIdToUpdate,
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
      id: editoastTrainScheduleIdToUpdate,
      trainScheduleForm: {
        ...trainSchedule,
        ...trainSchedulePayload,
        // Reset margins because they contain references to path items
        margins: undefined,
      },
    })
  ).unwrap();
  const formattedNewTrainSchedule: TrainScheduleResultWithTrainId = {
    ...newTrainSchedule,
    id: formatEditoastTrainIdToTrainScheduleId(newTrainSchedule.id),
  };
  addUpsertedTrainSchedules([formattedNewTrainSchedule]);
};

const handleTrainrunOperation = async ({
  type,
  trainrunId,
  dispatch,
  infraId,
  timeTableId,
  netzgrafikDto,
  addUpsertedTrainSchedules,
  addDeletedTrainIds,
  state,
}: {
  type: NGEEvent['type'];
  trainrunId: number;
  dispatch: AppDispatch;
  infraId: number;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  addDeletedTrainIds: (trainIds: TimetableItemId[]) => void;
  state: MacroEditorState;
}) => {
  const { nodes, labels, trainruns } = netzgrafikDto;
  const trainrun = trainruns.find((tr) => tr.id === trainrunId);
  switch (type) {
    case 'create': {
      const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(
        netzgrafikDto,
        trainrunId
      );
      const startDate = new Date();
      const newTrainSchedules = await dispatch(
        osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.initiate({
          id: timeTableId,
          body: [
            {
              ...DEFAULT_PAYLOAD,
              ...(await createTrainSchedulePayload({
                trainrunSections: trainrunSectionsByTrainrunId,
                nodes,
                trainrun: trainrun!,
                infraId,
                dispatch,
                labels,
                oldStartDate: startDate,
              })),
            },
          ],
        })
      ).unwrap();
      // TODO Paced train : Adapt to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10612
      const formattedNewTrainSchedules: TrainScheduleResultWithTrainId[] = newTrainSchedules.map(
        (trainSchedule) => ({
          ...trainSchedule,
          id: formatEditoastTrainIdToTrainScheduleId(trainSchedule.id),
        })
      );
      state.trainScheduleIdByNgeId.set(trainrunId, formattedNewTrainSchedules[0].id);
      addUpsertedTrainSchedules(formattedNewTrainSchedules);
      break;
    }
    case 'delete': {
      // TODO Paced train : Adapt to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10612
      const editoastTrainScheduleIdToDelete = formatTrainScheduleIdToEditoastTrainId(
        state.trainScheduleIdByNgeId.get(trainrunId) as TrainScheduleId
      );
      await dispatch(
        osrdEditoastApi.endpoints.deleteTrainSchedule.initiate({
          body: { ids: [editoastTrainScheduleIdToDelete] },
        })
      ).unwrap();
      addDeletedTrainIds([state.trainScheduleIdByNgeId.get(trainrunId)!]);
      state.trainScheduleIdByNgeId.delete(trainrunId);
      break;
    }
    case 'update': {
      await handleUpdateTrainSchedule({
        netzgrafikDto,
        trainrun: trainrun!,
        dispatch,
        infraId,
        addUpsertedTrainSchedules,
        state,
      });
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
}) => {
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
  addUpsertedTrainSchedules,
  state,
}: {
  type: NGEEvent['type'];
  label: LabelDto;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
  infraId: number;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  state: MacroEditorState;
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
  timeTableId,
  netzgrafikDto,
  addUpsertedTrainSchedules,
  addDeletedTrainIds,
}: {
  event: NGEEvent;
  dispatch: AppDispatch;
  state: MacroEditorState;
  infraId: number;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  addDeletedTrainIds: (trainIds: TimetableItemId[]) => void;
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
        timeTableId,
        netzgrafikDto,
        addUpsertedTrainSchedules,
        addDeletedTrainIds,
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
        addUpsertedTrainSchedules,
        state,
      });
      break;
    default:
      break;
  }
};

export default handleOperation;
