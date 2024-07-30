import { osrdEditoastApi, type TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import type { NetzgrafikDto, NGETrainrunEvent, TrainrunSection, Node, Trainrun } from './types';

const CREATED_TRAINRUN = new Map<number, number>();

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

const createPayloadOperation = (
  trainrunSections: TrainrunSection[],
  nodes: Node[],
  trainrun: Trainrun
) => {
  // TODO: check that the trainrunSections format is still compatible
  const path = trainrunSections.flatMap((section, index) => {
    const sourceNode = getNodeById(nodes, section.sourceNodeId);
    const targetNode = getNodeById(nodes, section.targetNodeId);
    if (!sourceNode || !targetNode) return [];
    const [sourceTrigram, sourceSecondaryCode] = sourceNode.betriebspunktName.split('/');
    const [targetTrigram, targetSecondaryCode] = targetNode.betriebspunktName.split('/');
    const originPathItem = {
      trigram: sourceTrigram,
      secondary_code: sourceSecondaryCode || 'BV',
      id: `${sourceNode.id}-${index}`,
    };
    const destinationPathItem = {
      trigram: targetTrigram,
      secondary_code: targetSecondaryCode || 'BV',
      id: `${targetNode.id}-${index}`,
    };
    if (index === trainrunSections.length - 1) {
      return [originPathItem, destinationPathItem];
    }
    return [originPathItem];
  });

  const payload: TrainScheduleBase = {
    ...DEFAULT_PAYLOAD,
    path,
    train_name: trainrun.name,
  };
  return payload;
};

const handleOperation = async ({
  event,
  dispatch,
  timeTableId,
  netzgrafikDto,
}: {
  event: NGETrainrunEvent;
  dispatch: AppDispatch;
  timeTableId: number;
  netzgrafikDto: NetzgrafikDto;
}) => {
  if (event.objectType !== 'trainrun') return;
  const { trainrun, type } = event;
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
          body: [createPayloadOperation(trainrunSectionsByTrainrunId, nodes, trainrun)],
        })
      ).unwrap();
      CREATED_TRAINRUN.set(trainrun.id, newTrainSchedules[0].id);
      break;
    }
    case 'delete': {
      const trainrunIdToDelete = CREATED_TRAINRUN.get(trainrun.id) || trainrun.id;
      await dispatch(
        osrdEditoastApi.endpoints.deleteV2TrainSchedule.initiate({
          body: { ids: [trainrunIdToDelete] },
        })
      ).unwrap();
      CREATED_TRAINRUN.delete(trainrun.id);
      break;
    }
    case 'update': {
      const trainrunIdToUpdate = CREATED_TRAINRUN.get(trainrun.id) || trainrun.id;
      await dispatch(
        osrdEditoastApi.endpoints.putV2TrainScheduleById.initiate({
          id: trainrunIdToUpdate,
          trainScheduleForm: createPayloadOperation(trainrunSectionsByTrainrunId, nodes, trainrun),
        })
      ).unwrap();
      break;
    }
    default:
      break;
  }
};

export default handleOperation;
