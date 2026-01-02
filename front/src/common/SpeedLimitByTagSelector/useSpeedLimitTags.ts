import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { getSpeedLimitTags } from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

const useSpeedLimitTags = ({ isStdcm }?: { isStdcm?: boolean }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const infraID = useInfraID();
  const stdcmSpeedLimitTags = useSelector(getSpeedLimitTags);
  const { updateSpeedLimitByTag } = useOsrdConfActions();

  const dispatchUpdateSpeedLimitByTag = (newTag: string | null) => {
    dispatch(updateSpeedLimitByTag(newTag));
  };
  const { data: speedLimitsTagsByInfraId = [], error } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      infraID && !isStdcm
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

  const speedLimitsByTags = isStdcm
    ? Object.keys(stdcmSpeedLimitTags || {})
    : uniq(speedLimitsTagsByInfraId);
  const speedLimitsByTagsOrdered = useMemo(() => speedLimitsByTags.sort(), [speedLimitsByTags]);

  return {
    speedLimitsByTags: speedLimitsByTagsOrdered,
    dispatchUpdateSpeedLimitByTag,
  };
};

export default useSpeedLimitTags;
