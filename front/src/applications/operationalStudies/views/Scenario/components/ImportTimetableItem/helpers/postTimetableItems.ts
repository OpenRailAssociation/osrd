import { osrdEditoastApi, type PacedTrain } from 'common/api/osrdEditoastApi';
import type { TimetableItem } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';

const postTimetableItems = async (
  timetableId: number,
  payloads: PacedTrain[],
  dispatch: AppDispatch
) => {
  let timetableItems: TimetableItem[] = [];
  if (payloads.length) {
    timetableItems = await dispatch(
      osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
        id: timetableId,
        body: payloads,
      })
    ).unwrap();
  }
  return timetableItems;
};

export default postTimetableItems;
