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
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import './SpeedLimitByTagSelector.scss';

type SpeedLimitByTagSelectorProps = {
  t?: (key: string) => string;
  condensed?: boolean;
  speedLimitByTag?: string;
  speedLimitsByTagsFromApi?: string[];
  dispatchUpdateSpeedLimitByTag?: (tag: string) => Dispatch | void;
};

function withOSRDInfraData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const dispatch = useDispatch();
    const infraID = useSelector(getInfraID);
    const speedLimitByTag = useSelector(getSpeedLimitByTag);
    const { data, error } = osrdEditoastApi.useGetInfraByIdSpeedLimitTagsQuery(
      {
        id: infraID as number,
      },
      { skip: !infraID }
    );
    const dispatchUpdateSpeedLimitByTag = (newTag: string) => {
      dispatch(updateSpeedLimitByTag(newTag));
    };

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
        t={t}
        dispatch={dispatch}
        speedLimitsByTagsFromApi={data}
        speedLimitByTag={speedLimitByTag}
        dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
      />
    );
  };
}

export function IsolatedSpeedLimitByTagSelector({
  speedLimitByTag,
  condensed = false,
  speedLimitsByTagsFromApi = [],
  dispatchUpdateSpeedLimitByTag = noop,
  t = (key) => key,
}: SpeedLimitByTagSelectorProps) {
  const [speedLimitsTags, setSpeedLimitByTags] = useState<string[]>(speedLimitsByTagsFromApi);

  useEffect(() => {
    // Update the document title using the browser API
    setSpeedLimitByTags(speedLimitsByTagsFromApi);
  }, [speedLimitsByTagsFromApi]);

  return speedLimitsTags.length > 0 ? (
    <div className="osrd-config-item mb-2">
      <div
        className={`osrd-config-item-container ${
          condensed ? 'd-flex align-items-center gap-10' : ''
        }`}
      >
        <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
        <span className="text-muted">{t('speedLimitByTag')}</span>
        <SelectImprovedSNCF
          options={speedLimitsTags}
          onChange={(e) => dispatchUpdateSpeedLimitByTag(e)}
          selectedValue={speedLimitByTag}
          sm
          withSearch
          data-testid="speed-limit-by-tag-selector"
        />
      </div>
    </div>
  ) : null;
}

export default withOSRDInfraData(IsolatedSpeedLimitByTagSelector);
