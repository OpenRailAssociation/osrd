import React, { useEffect, useMemo } from 'react';
import type { ComponentType } from 'react';
import type { Dispatch } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { isEmpty, noop } from 'lodash';

import icon from 'assets/pictures/components/speedometer.svg';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';

import { setFailure } from 'reducers/main';

import 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector.scss';

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
    const { getSpeedLimitByTag } = useOsrdConfSelectors();
    const infraID = useInfraID();
    const speedLimitByTag = useSelector(getSpeedLimitByTag);
    const { data: speedLimitsByTags = [], error } =
      osrdEditoastApi.useGetInfraByIdSpeedLimitTagsQuery(
        {
          id: infraID as number,
        },
        { skip: !infraID }
      );
    const { updateSpeedLimitByTag } = useOsrdConfActions();
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

  if (!speedLimitsTagsList.length) return null;
  return (
    <div className="osrd-config-item mb-2">
      <div
        className={`osrd-config-item-container ${
          condensed ? 'd-flex align-items-center gap-10' : ''
        }`}
      >
        <img width="32px" src={icon} alt="speedometer" />
        <span className="text-muted">{t('speedLimitByTag')}</span>
        <SelectImprovedSNCF
          sm
          withSearch
          dataTestId="speed-limit-by-tag-selector"
          value={speedLimitByTag || t('noSpeedLimitByTag').toString()}
          options={speedLimitsTagsList}
          onChange={(e) => {
            if (e) dispatchUpdateSpeedLimitByTag(e);
          }}
        />
      </div>
    </div>
  );
}

export default withOSRDInfraData(IsolatedSpeedLimitByTagSelector);
