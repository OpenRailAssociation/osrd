import { osrdEditoastApi, type PacedTrain } from 'common/api/osrdEditoastApi';
import type { PacedTrainWithPacedTrainId } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

const postTimetableItems = async (
  timetableId: number,
  payloads: PacedTrain[],
  dispatch: AppDispatch
) => {
  let timetableItems: PacedTrainWithPacedTrainId[] = [];
  if (payloads.length) {
    const rawTimetableItems = await dispatch(
      osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
        id: timetableId,
        body: payloads,
      })
    ).unwrap();

    timetableItems = rawTimetableItems.map((timetableItem) => ({
      ...timetableItem,
      id: formatEditoastIdToPacedTrainId(timetableItem.id),
    }));
  }
  return { timetableItems };
};

export default postTimetableItems;
