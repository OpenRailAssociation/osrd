import { osrdEditoastApi, type PacedTrain } from 'common/api/osrdEditoastApi';
import type { TimetableItem } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

const postTimetableItems = async (
  trainScheduleSetId: number,
  payloads: PacedTrain[],
  dispatch: AppDispatch
) => {
  let timetableItems: TimetableItem[] = [];
  if (payloads.length) {
    const rawTimetableItems = await dispatch(
      osrdEditoastApi.endpoints.postTrainScheduleSetByIdPacedTrains.initiate({
        id: trainScheduleSetId,
        body: payloads,
      })
    ).unwrap();

    timetableItems = rawTimetableItems.map((timetableItem) => ({
      ...timetableItem,
      id: formatEditoastIdToPacedTrainId(timetableItem.id),
    }));
  }
  return timetableItems;
};

export default postTimetableItems;
