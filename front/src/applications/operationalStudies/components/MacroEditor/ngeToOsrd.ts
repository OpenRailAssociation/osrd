import { osrdEditoastApi, type TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import nodeStore from './nodeStore';
import type { NetzgrafikDto, NGEEvent, TrainrunSection, Node, Trainrun } from './types';

const createdTrainrun = new Map<number, number>();

const getTrainrunSectionsByTrainrunId = (trainrunSections: TrainrunSection[], trainrunId: number) =>
  trainrunSections.filter((section) => section.trainrunId === trainrunId);

const getNodeById = (nodes: Node[], nodeId: number | string) =>
  nodes.find((node) => node.id === nodeId);

// TODO: add a dynamic values when available
const DEFAULT_PAYLOAD: Pick<
  TrainScheduleBase,
  'constraint_distribution' | 'rolling_stock_name' | 'start_time'
> = {
  constraint_distribution: 'STANDARD',
  rolling_stock_name: '',
  start_time: '2024-07-15T08:00:00+02:00',
};

const createPathItemFromNode = (node: Node, index: number) => {
  const [trigram, secondaryCode] = node.betriebspunktName.split('/');
  return {
    trigram,
    secondary_code: secondaryCode || 'BV',
    id: `${node.id}-${index}`,
  };
};

const createTrainSchedulePayload = (
  trainrunSections: TrainrunSection[],
  nodes: Node[],
  trainrun: Trainrun
) => {
  // TODO: check that the trainrunSections format is still compatible
  const path = trainrunSections.flatMap((section, index) => {
    const sourceNode = getNodeById(nodes, section.sourceNodeId);
    const targetNode = getNodeById(nodes, section.targetNodeId);
    if (!sourceNode || !targetNode) return [];
    const originPathItem = createPathItemFromNode(sourceNode, index);
    if (index === trainrunSections.length - 1) {
      const destinationPathItem = createPathItemFromNode(targetNode, index);
      return [originPathItem, destinationPathItem];
    }
    return [originPathItem];
  });

  return {
    path,
    train_name: trainrun.name,
  };
};

const handleTrainrunOperation = async ({
  type,
  trainrun,
  dispatch,
  timeTableId,
  netzgrafikDto,
}: {
  type: NGEEvent['type'];
  trainrun: Trainrun;
  dispatch: AppDispatch;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
}) => {
  const { trainrunSections, nodes } = netzgrafikDto;
  const trainrunSectionsByTrainrunId = getTrainrunSectionsByTrainrunId(
    trainrunSections,
    trainrun.id
  );
  switch (type) {
    case 'create': {
      const newTrainSchedules = await dispatch(
        osrdEditoastApi.endpoints.postV2TimetableByIdTrainSchedule.initiate({
          id: timeTableId,
          body: [
            {
              ...DEFAULT_PAYLOAD,
              ...createTrainSchedulePayload(trainrunSectionsByTrainrunId, nodes, trainrun),
            },
          ],
        })
      ).unwrap();
      createdTrainrun.set(trainrun.id, newTrainSchedules[0].id);
      break;
    }
    case 'delete': {
      const trainrunIdToDelete = createdTrainrun.get(trainrun.id) || trainrun.id;
      await dispatch(
        osrdEditoastApi.endpoints.deleteV2TrainSchedule.initiate({
          body: { ids: [trainrunIdToDelete] },
        })
      ).unwrap();
      createdTrainrun.delete(trainrun.id);
      break;
    }
    case 'update': {
      const trainrunIdToUpdate = createdTrainrun.get(trainrun.id) || trainrun.id;
      const trainSchedule = await dispatch(
        osrdEditoastApi.endpoints.getV2TrainScheduleById.initiate({
          id: trainrunIdToUpdate,
        })
      ).unwrap();
      await dispatch(
        osrdEditoastApi.endpoints.putV2TrainScheduleById.initiate({
          id: trainrunIdToUpdate,
          trainScheduleForm: {
            ...trainSchedule,
            ...createTrainSchedulePayload(trainrunSectionsByTrainrunId, nodes, trainrun),
            // TODO: convert NGE times to OSRD schedule
            schedule: [],
          },
        })
      ).unwrap();
      break;
    }
    default:
      break;
  }
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
  const { betriebspunktName: trigram, positionX, positionY } = node;
  switch (type) {
    case 'create':
    case 'update': {
      nodeStore.set(timeTableId, { trigram, positionX, positionY });
      break;
    }
    case 'delete': {
      nodeStore.delete(timeTableId, trigram);
      break;
    }
    default:
      break;
  }
};

const handleOperation = async ({
  event,
  dispatch,
  timeTableId,
  netzgrafikDto,
}: {
  event: NGEEvent;
  dispatch: AppDispatch;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
}) => {
  const { type } = event;
  switch (event.objectType) {
    case 'node':
      handleNodeOperation({ type, node: event.node!, timeTableId });
      break;
    case 'trainrun':
      await handleTrainrunOperation({
        type,
        trainrun: event.trainrun!,
        dispatch,
        timeTableId,
        netzgrafikDto,
      });
      break;
    default:
      break;
  }
};

export default handleOperation;
