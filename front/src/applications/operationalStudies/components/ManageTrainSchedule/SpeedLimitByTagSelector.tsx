import React, { ComponentType, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateSpeedLimitByTag } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main';
import icon from 'assets/pictures/components/speedometer.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { getInfraID, getSpeedLimitByTag } from 'reducers/osrdconf/selectors';
import { Dispatch } from 'redux';
import { noop } from 'lodash';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

type SpeedLimitByTagSelectorProps = {
  condensed?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  speedLimitByTag?: string;
  dispatch?: Dispatch;
  speedLimitsByTagsFromApi?: string[];
};

function withOSRDData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const dispatch = useDispatch();
    const infraID = useSelector(getInfraID);
    const speedLimitByTag = useSelector(getSpeedLimitByTag);
    const { data, error } = osrdMiddlewareApi.useGetInfraByIdSpeedLimitTagsQuery(
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

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        speedLimitsByTagsFromApi={data}
        speedLimitByTag={speedLimitByTag}
      />
    );
  };
}

export function SpeedLimitByTagSelector({
  speedLimitByTag,
  dispatch = noop,
  condensed = false,
  speedLimitsByTagsFromApi,
}: SpeedLimitByTagSelectorProps) {
  const [speedLimitsTags, setSpeedLimitByTags] = useState<string[] | undefined>(
    speedLimitsByTagsFromApi
  );
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  useEffect(() => {
    // Update the document title using the browser API
    setSpeedLimitByTags(speedLimitsByTagsFromApi);
  }, [speedLimitsByTagsFromApi]);

  return speedLimitsTags ? (
    <div className="osrd-config-item mb-2">
      <div className={`osrd-config-item-container ${condensed ? 'flex-on-line' : ''}`}>
        <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
        <span className="text-muted">{t('speedLimitByTag')}</span>
        <SelectImprovedSNCF
          options={speedLimitsTags}
          onChange={(e) => dispatch(updateSpeedLimitByTag(e))}
          selectedValue={speedLimitByTag}
          sm
          withSearch
          data-testid="speed-limit-by-tag-selector"
        />
      </div>
    </div>
  ) : null;
}

export default withOSRDData(SpeedLimitByTagSelector);
