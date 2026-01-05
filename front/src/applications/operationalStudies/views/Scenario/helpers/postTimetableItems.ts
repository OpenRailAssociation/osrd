import { osrdEditoastApi, type PacedTrain, type TrainSchedule } from 'common/api/osrdEditoastApi';
import type { PacedTrainWithPacedTrainId, TrainScheduleWithTrainId } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

const postTimetableItems = async (
  timetableId: number,
  trainSchedulePayloads: TrainSchedule[],
  pacedTrainPayloads: PacedTrain[],
  dispatch: AppDispatch
) => {
  let trainSchedules: TrainScheduleWithTrainId[] = [];
  if (trainSchedulePayloads.length) {
    const rawTrainSchedules = await dispatch(
      osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.initiate({
        id: timetableId,
        body: trainSchedulePayloads,
      })
    ).unwrap();

    trainSchedules = rawTrainSchedules.map((trainSchedule) => ({
      ...trainSchedule,
      id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
    }));
  }

  let pacedTrains: PacedTrainWithPacedTrainId[] = [];
  if (pacedTrainPayloads.length) {
    const rawPacedTrains = await dispatch(
      osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
        id: timetableId,
        body: pacedTrainPayloads,
      })
    ).unwrap();

    pacedTrains = rawPacedTrains.map((pacedTrain) => ({
      ...pacedTrain,
      id: formatEditoastIdToPacedTrainId(pacedTrain.id),
    }));
  }
  return { trainSchedules, pacedTrains };
};

export default postTimetableItems;
