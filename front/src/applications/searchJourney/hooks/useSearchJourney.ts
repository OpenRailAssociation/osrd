import { useCallback, useRef, useState } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi, type JourneyProposals } from 'common/api/osrdEditoastApi';
import {
  getSearchJourneyDestination,
  getSearchJourneyInfraId,
  getSearchJourneyOrigin,
  getSearchJourneyStartTime,
  getSearchJourneyTimetableIds,
} from 'reducers/searchJourney/selectors';
import { timeToMsSinceMidnight } from 'utils/date';

export const SEARCH_JOURNEY_REQUEST_STATUS = Object.freeze({
  idle: 'IDLE',
  pending: 'PENDING',
  success: 'SUCCESS',
  rejected: 'REJECTED',
  canceled: 'CANCELED',
});

// Fixed for now, per the implementation plan (no UI to configure them yet).
const START_TOLERANCE_MS = 3600000;
const TRANSFER_MS = 0;

/**
 * Builds and sends the `/search_journeys` payload from the searchJourney store.
 */
export default function useSearchJourney() {
  const infraId = useSelector(getSearchJourneyInfraId);
  const timetableIds = useSelector(getSearchJourneyTimetableIds);
  const origin = useSelector(getSearchJourneyOrigin);
  const destination = useSelector(getSearchJourneyDestination);
  const startTime = useSelector(getSearchJourneyStartTime);

  const [postSearchJourneys] = osrdEditoastApi.endpoints.postSearchJourneys.useMutation();
  const currentRequestRef = useRef<ReturnType<typeof postSearchJourneys> | null>(null);

  const [requestStatus, setRequestStatus] = useState<
    (typeof SEARCH_JOURNEY_REQUEST_STATUS)[keyof typeof SEARCH_JOURNEY_REQUEST_STATUS]
  >(SEARCH_JOURNEY_REQUEST_STATUS.idle);
  const [journeys, setJourneys] = useState<JourneyProposals['journeys']>();
  const [error, setError] = useState<Error | null>(null);

  const isFormComplete = Boolean(infraId && origin && destination && startTime);

  const launchSearchJourneyRequest = useCallback(async () => {
    if (!infraId || !origin || !destination || !startTime) return;

    setRequestStatus(SEARCH_JOURNEY_REQUEST_STATUS.pending);
    setError(null);
    const request = postSearchJourneys({
      journeySearchQuery: {
        infra_id: infraId,
        timetable_ids: timetableIds,
        origin: {
          operational_point: {
            type: 'domestic',
            main_code: origin.mainCode,
            country_code: origin.countryCode,
            secondary_code: origin.secondaryCode,
          },
        },
        destination: {
          operational_point: {
            type: 'domestic',
            main_code: destination.mainCode,
            country_code: destination.countryCode,
            secondary_code: destination.secondaryCode,
          },
        },
        start_ms: timeToMsSinceMidnight(startTime),
        start_tolerance: START_TOLERANCE_MS,
        transfer_ms: TRANSFER_MS,
      },
    });
    currentRequestRef.current = request;
    try {
      const { journeys: result } = await request.unwrap();
      setJourneys(result);
      setRequestStatus(SEARCH_JOURNEY_REQUEST_STATUS.success);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setRequestStatus(SEARCH_JOURNEY_REQUEST_STATUS.canceled);
      } else {
        setError(e as Error);
        setRequestStatus(SEARCH_JOURNEY_REQUEST_STATUS.rejected);
      }
    } finally {
      currentRequestRef.current = null;
    }
  }, [postSearchJourneys, infraId, timetableIds, origin, destination, startTime]);

  const cancelSearchJourneyRequest = useCallback(() => {
    currentRequestRef.current?.abort();
  }, []);

  return {
    launchSearchJourneyRequest,
    cancelSearchJourneyRequest,
    requestStatus,
    journeys,
    error,
    isFormComplete,
  };
}
