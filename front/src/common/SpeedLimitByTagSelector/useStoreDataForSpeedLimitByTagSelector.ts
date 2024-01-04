import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors, useOsrdConfActions, useInfraID } from 'common/osrdContext';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { setFailure } from 'reducers/main';

export const useStoreDataForSpeedLimitByTagSelector = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { getSpeedLimitByTag } = useOsrdConfSelectors();
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const infraID = useInfraID();

  const { updateSpeedLimitByTag } = useOsrdConfActions();
  const dispatchUpdateSpeedLimitByTag = (newTag: string) => {
    dispatch(updateSpeedLimitByTag(newTag));
  };

  const { data: speedLimitsByTags = [], error } =
    osrdEditoastApi.endpoints.getInfraByIdSpeedLimitTags.useQuery(
      {
        id: infraID as number,
      },
      { skip: !infraID }
    );

  useEffect(() => {
    // Update the document title using the browser API
    if (error) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveTags'),
          message: `${(error as FetchBaseQueryError).status} : ${JSON.stringify(
            (error as FetchBaseQueryError).data
          )}`,
        })
      );
    }
  }, [error]);

  return { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag };
};

export default useStoreDataForSpeedLimitByTagSelector;
