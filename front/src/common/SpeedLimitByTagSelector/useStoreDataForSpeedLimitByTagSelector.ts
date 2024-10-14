import { useEffect, useMemo } from 'react';

import { compact, concat, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { COMPOSITION_CODES } from 'applications/stdcm/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors, useOsrdConfActions, useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

export const useStoreDataForSpeedLimitByTagSelector = ({ isStdcm } = { isStdcm: false }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { getSpeedLimitByTag } = useOsrdConfSelectors();
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const infraID = useInfraID();

  const { updateSpeedLimitByTag } = useOsrdConfActions();
  const dispatchUpdateSpeedLimitByTag = (newTag: string | null) => {
    dispatch(updateSpeedLimitByTag(newTag));
  };

  const { data: speedLimitTags } = osrdEditoastApi.endpoints.getSpeedLimitTags.useQuery(undefined, {
    skip: isStdcm,
  });

  const { data: speedLimitsTagsByInfraId = [], error } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      {
        infraId: infraID!,
      },
      { skip: !infraID || isStdcm }
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
    ? COMPOSITION_CODES
    : compact(uniq(concat(speedLimitTags, speedLimitsTagsByInfraId)));
  const speedLimitsByTagsOrdered = useMemo(() => speedLimitsByTags.sort(), [speedLimitsByTags]);

  return {
    speedLimitByTag,
    speedLimitsByTags: speedLimitsByTagsOrdered,
    dispatchUpdateSpeedLimitByTag,
  };
};

export default useStoreDataForSpeedLimitByTagSelector;
