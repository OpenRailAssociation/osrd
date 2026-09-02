import { useCallback, useEffect, useRef, useState } from 'react';

import { uniqBy } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import type { TrainId } from 'reducers/osrdconf/types';
import { getFeatureFlag } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import {
  formatTrainIdToLinkingOccurrence,
  parseLinkings,
  type ExistingLinking,
} from './helpers/linkings';
import { batchFetch } from './helpers/utils';

/** Train schedules asked at once when listing linkings, to keep each response small. */
const LINKINGS_BATCH_SIZE = 100;

/**
 * Lists the linkings of the trains displayed in the space time chart, and creates or deletes them
 * on demand. Editoast answers a creation with the linking it stored, so the list stays true
 * without being loaded again.
 */
const useLinkings = ({
  timetableId,
  trainScheduleIds,
}: {
  timetableId: number;
  trainScheduleIds: number[];
}): {
  linkings: ExistingLinking[];
  createLinking: (source: TrainId, target: TrainId) => Promise<void>;
  deleteLinking: (linkingId: number) => Promise<void>;
} => {
  const dispatch = useAppDispatch();
  const linkingsEnabled = useSelector(getFeatureFlag('linkings'));

  /** The displayed trains as a value, to list the linkings again only when they really change. */
  const displayedTrains = trainScheduleIds.join();

  const [linkings, setLinkings] = useState<ExistingLinking[]>([]);
  /**
   * The canvas answers a click with what it painted on its last frame, which may be one linking
   * late. Reading the linkings through a ref tells a stale click from a real one.
   */
  const currentLinkings = useRef(linkings);
  currentLinkings.current = linkings;
  /** The creations editoast has not answered yet, which a second click must not send again. */
  const askedCreations = useRef(new Set<string>());

  const [createLinkings] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleLinkings.useMutation();
  const [deleteLinkings] = osrdEditoastApi.endpoints.postTrainSchedulesLinkingsDelete.useMutation();

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

  const createLinking = useCallback(
    async (source: TrainId, target: TrainId) => {
      const asked = `${source}-${target}`;
      const isLinked = currentLinkings.current.some(
        (linking) => linking.source === source || linking.target === target
      );
      if (isLinked || askedCreations.current.has(asked)) return;
      askedCreations.current.add(asked);

      try {
        const created = await createLinkings({
          id: timetableId,
          body: [
            {
              source: formatTrainIdToLinkingOccurrence(source),
              target: formatTrainIdToLinkingOccurrence(target),
            },
          ],
        }).unwrap();
        setLinkings((previous) => [...previous, ...parseLinkings(created)]);
      } catch (error) {
        dispatch(setFailure(castErrorToFailure(error)));
      } finally {
        askedCreations.current.delete(asked);
      }
    },
    [timetableId]
  );

  const deleteLinking = useCallback(async (linkingId: number) => {
    const deleted = currentLinkings.current.find(({ id }) => id === linkingId);
    if (!deleted) return;

    // Dropped right away, so that a second click finds it gone instead of deleting it again.
    setLinkings((previous) => previous.filter(({ id }) => id !== linkingId));
    try {
      await deleteLinkings({ body: [linkingId] }).unwrap();
    } catch (error) {
      setLinkings((previous) => [...previous, deleted]);
      dispatch(setFailure(castErrorToFailure(error)));
    }
  }, []);

  return { linkings, createLinking, deleteLinking };
};

export default useLinkings;
