import { useEffect } from 'react';

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

  const { getSpeedLimitByTag } = useOsrdConfSelectors();
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const infraID = useInfraID();

  const { updateSpeedLimitByTag } = useOsrdConfActions();
  const dispatchUpdateSpeedLimitByTag = (newTag: string) => {
    dispatch(updateSpeedLimitByTag(newTag));
  };

  const { data: speedLimitsByTags = [], error } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      {
        infraId: infraID as number,
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

  return { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag };
};

export default useStoreDataForSpeedLimitByTagSelector;
