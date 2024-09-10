import { useEffect, useMemo } from 'react';

import { compact, concat, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors, useOsrdConfActions, useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

export const useStoreDataForSpeedLimitByTagSelector = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const DEFAULT_SPEED_LIMIT_TAG = useMemo(() => t('noSpeedLimitByTag'), [t]);

  const { getSpeedLimitByTag } = useOsrdConfSelectors();
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const infraID = useInfraID();

  const { updateSpeedLimitByTag } = useOsrdConfActions();
  const dispatchUpdateSpeedLimitByTag = (newTag: string | null) => {
    dispatch(updateSpeedLimitByTag(newTag));
  };

  const { data: speedLimitTags } = osrdEditoastApi.endpoints.getSpeedLimitTags.useQuery();

  const { data: speedLimitsTagsByInfraId = [], error } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      {
        infraId: infraID!,
      },
      { skip: !infraID }
    );
  useEffect(() => {
    // Update the document title using the browser API
    if (error) {
      dispatch(
        setFailure(castErrorToFailure(error, { name: t('errorMessages.unableToRetrieveTags') }))
      );
    }
  }, [error]);

  let speedLimitsByTags = compact(uniq(concat(speedLimitTags, speedLimitsTagsByInfraId)));
  const speedLimitsByTagsOrdered = useMemo(() => speedLimitsByTags.sort(), [speedLimitsByTags]);

  speedLimitsByTags = [DEFAULT_SPEED_LIMIT_TAG, ...speedLimitsByTagsOrdered];

  return { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag };
};

export default useStoreDataForSpeedLimitByTagSelector;
