import React, { ComponentType, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateSpeedLimitByTag } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main';
import icon from 'assets/pictures/components/speedometer.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { getInfraID, getSpeedLimitByTag } from 'reducers/osrdconf/selectors';
import { Dispatch } from 'redux';
import { isEmpty, noop } from 'lodash';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import './SpeedLimitByTagSelector.scss';

type SpeedLimitByTagSelectorProps = {
  t?: (key: string) => string;
  condensed?: boolean;
  speedLimitByTag?: string;
  speedLimitsByTags?: string[];
  dispatchUpdateSpeedLimitByTag?: (tag: string) => Dispatch | void;
};

function withOSRDInfraData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const dispatch = useDispatch();
    const infraID = useSelector(getInfraID);
    const speedLimitByTag = useSelector(getSpeedLimitByTag);
    const { data: speedLimitsByTags = [], error } =
      osrdEditoastApi.useGetInfraByIdSpeedLimitTagsQuery(
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
        speedLimitsByTags={speedLimitsByTags}
        speedLimitByTag={speedLimitByTag}
        dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
      />
    );
  };
}

export function IsolatedSpeedLimitByTagSelector({
  speedLimitByTag,
  condensed = false,
  speedLimitsByTags = [],
  dispatchUpdateSpeedLimitByTag = noop,
  t = (key) => key,
}: SpeedLimitByTagSelectorProps) {
  const speedLimitsTagsList = useMemo(
    () =>
      !isEmpty(speedLimitsByTags)
        ? [t('noSpeedLimitByTag'), ...Object.values(speedLimitsByTags)]
        : [],
    [speedLimitsByTags]
  );

  return speedLimitsTagsList.length > 0 ? (
    <div className="osrd-config-item mb-2">
      <div
        className={`osrd-config-item-container ${
          condensed ? 'd-flex align-items-center gap-10' : ''
        }`}
      >
        <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
        <span className="text-muted">{t('speedLimitByTag')}</span>
        <SelectImprovedSNCF
          options={speedLimitsTagsList}
          onChange={(e) => dispatchUpdateSpeedLimitByTag(e)}
          selectedValue={speedLimitByTag || t('noSpeedLimitByTag')}
          sm
          withSearch
          data-testid="speed-limit-by-tag-selector"
        />
      </div>
    </div>
  ) : null;
}

export default withOSRDInfraData(IsolatedSpeedLimitByTagSelector);
