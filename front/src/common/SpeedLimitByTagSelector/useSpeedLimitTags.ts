import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { uniq } from 'lodash';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

/**
 * Hook to retrieve the speed limit tags of the concerned infrastructure.
 *
 * WARNING: this hook should not be used in the STDCM application since only
 * some speed limit tags should be available for users (stored in the stdcm
 * environment configuration)
 */
const useSpeedLimitTags = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const infraID = useInfraID();
  const { updateSpeedLimitByTag } = useOsrdConfActions();

  const dispatchUpdateSpeedLimitByTag = (newTag: string | null) => {
    dispatch(updateSpeedLimitByTag(newTag));
  };

  const { data: speedLimitsTagsByInfraId = [], error } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      infraID
        ? {
            infraId: infraID,
          }
        : skipToken
    );

  useEffect(() => {
    // Update the document title using the browser API
    if (error) {
      dispatch(
        setFailure(castErrorToFailure(error, { name: t('errorMessages.unableToRetrieveTags') }))
      );
    }
  }, [error]);

  const speedLimitsByTagsOrdered = useMemo(
    () => uniq(speedLimitsTagsByInfraId).sort(),
    [speedLimitsTagsByInfraId]
  );

  return {
    speedLimitsByTags: speedLimitsByTagsOrdered,
    dispatchUpdateSpeedLimitByTag,
  };
};

export default useSpeedLimitTags;
