import {
  osrdEditoastApi,
  type SearchResultItemOperationalPoint,
  type TrainScheduleBase,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import nodeStore from './nodeStore';
import type { NetzgrafikDto, NGEEvent, TrainrunSection, Node, Trainrun } from '../NGE/types';

const createdTrainrun = new Map<number, number>();

const getNodeById = (nodes: Node[], nodeId: number | string) =>
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
  let departureSection: TrainrunSection | undefined;
  const sectionsByPrevTargetPortId = new Map<number, TrainrunSection>();
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
  let section: TrainrunSection | undefined = departureSection;
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

// TODO: add a dynamic values when available
const DEFAULT_PAYLOAD: Pick<
  TrainScheduleBase,
  'constraint_distribution' | 'rolling_stock_name' | 'start_time'
> = {
  constraint_distribution: 'STANDARD',
  rolling_stock_name: '',
  start_time: '2024-07-15T08:00:00+02:00',
};

const createPathItemFromNode = async (
  node: Node,
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

const createTrainSchedulePayload = async (
  trainrunSections: TrainrunSection[],
  nodes: Node[],
  trainrun: Trainrun,
  infraId: number,
  dispatch: AppDispatch
) => {
  // TODO: check that the trainrunSections format is still compatible
  const pathPromise = trainrunSections.map(async (section, index) => {
    const sourceNode = getNodeById(nodes, section.sourceNodeId);
    const targetNode = getNodeById(nodes, section.targetNodeId);
    if (!sourceNode || !targetNode) return [];
    const originPathItem = await createPathItemFromNode(sourceNode, index, infraId, dispatch);
    if (index === trainrunSections.length - 1) {
      const destinationPathItem = await createPathItemFromNode(
        targetNode,
        index,
        infraId,
        dispatch
      );
      return [originPathItem, destinationPathItem];
    }
    return [originPathItem];
  });

  const path = await Promise.all(pathPromise);

  return {
    path: path.flat(),
    train_name: trainrun.name,
  };
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
  trainrun: Trainrun;
  dispatch: AppDispatch;
  infraId: number;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  addDeletedTrainIds: (trainIds: number[]) => void;
}) => {
  const { nodes } = netzgrafikDto;

  switch (type) {
    case 'create': {
      const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(
        netzgrafikDto,
        trainrun.id
      );
      const newTrainSchedules = await dispatch(
        osrdEditoastApi.endpoints.postTimetableByIdTrainSchedule.initiate({
          id: timeTableId,
          body: [
            {
              ...DEFAULT_PAYLOAD,
              ...(await createTrainSchedulePayload(
                trainrunSectionsByTrainrunId,
                nodes,
                trainrun,
                infraId,
                dispatch
              )),
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
      const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(
        netzgrafikDto,
        trainrun.id
      );
      const trainrunIdToUpdate = createdTrainrun.get(trainrun.id) || trainrun.id;
      const trainSchedule = await dispatch(
        osrdEditoastApi.endpoints.getTrainScheduleById.initiate({
          id: trainrunIdToUpdate,
        })
      ).unwrap();
      const newTrainSchedule = await dispatch(
        osrdEditoastApi.endpoints.putTrainScheduleById.initiate({
          id: trainrunIdToUpdate,
          trainScheduleForm: {
            ...trainSchedule,
            ...(await createTrainSchedulePayload(
              trainrunSectionsByTrainrunId,
              nodes,
              trainrun,
              infraId,
              dispatch
            )),
            // TODO: convert NGE times to OSRD schedule
            schedule: [],
          },
        })
      ).unwrap();
      addUpsertedTrainSchedules([newTrainSchedule]);
      break;
    }
    default:
      break;
  }
};

const handleUpdateNode = (timeTableId: number, node: Node) => {
  const { betriebspunktName: trigram, positionX, positionY } = node;
  nodeStore.set(timeTableId, { trigram, positionX, positionY });
};

const handleNodeOperation = ({
  type,
  node,
  timeTableId,
}: {
  type: NGEEvent['type'];
  node: Node;
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
  switch (event.objectType) {
    case 'node':
      handleNodeOperation({ type, node: event.node, timeTableId });
      break;
    case 'trainrun':
      await handleTrainrunOperation({
        type,
        trainrun: event.trainrun,
        dispatch,
        infraId,
        timeTableId,
        netzgrafikDto,
        addUpsertedTrainSchedules,
        addDeletedTrainIds,
      });
      break;
    default:
      break;
  }
};

export default handleOperation;
