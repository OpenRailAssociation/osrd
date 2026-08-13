import { useEffect, useState } from 'react';

import { uniqBy } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { getFeatureFlag } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { parseLinkings, type ExistingLinking } from './helpers/linkings';
import { batchFetch } from './helpers/utils';

/** Train schedules asked at once when listing linkings, to keep each response small. */
const LINKINGS_BATCH_SIZE = 100;

/**
 * Lists the linkings of the trains displayed in the space time chart. The list grows batch after
 * batch, so the first ones show up without waiting for the last.
 */
const useLinkings = ({
  timetableId,
  trainScheduleIds,
}: {
  timetableId: number;
  trainScheduleIds: number[];
}): ExistingLinking[] => {
  const dispatch = useAppDispatch();
  const linkingsEnabled = useSelector(getFeatureFlag('linkings'));

  /** The displayed trains as a value, to list the linkings again only when they really change. */
  const displayedTrains = trainScheduleIds.join();

  const [linkings, setLinkings] = useState<ExistingLinking[]>([]);

  useEffect(() => {
    if (!linkingsEnabled || !trainScheduleIds.length) {
      setLinkings([]);
      return undefined;
    }

    return batchFetch(
      trainScheduleIds,
      async (ids) =>
        parseLinkings(
          await dispatch(
            osrdEditoastApi.endpoints.postTrainSchedulesLinkings.initiate(
              { body: { timetable_id: timetableId, train_schedules: ids } },
              { subscribe: false }
            )
          ).unwrap()
        ),
      {
        batchSize: LINKINGS_BATCH_SIZE,
        // Editoast answers with a linking on each of its ends, so two batches may bring the same.
        onProgress: (allLinkings) => setLinkings(uniqBy(allLinkings, 'id')),
        onError: (error) => dispatch(setFailure(castErrorToFailure(error))),
      }
    );
  }, [linkingsEnabled, timetableId, displayedTrains]);

  return linkings;
};

export default useLinkings;
