import React, { ComponentType, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateSpeedLimitByTag } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import icon from 'assets/pictures/components/speedometer.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { getInfraID, getSpeedLimitByTag } from 'reducers/osrdconf/selectors';
import { Dispatch } from 'redux';

type SpeedLimitByTagSelectorProps = {
  condensed?: boolean;
  infraID?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  speedLimitByTag?: any;
  dispatch: Dispatch;
};

function withOSRDData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const dispatch = useDispatch();
    const infraID = useSelector(getInfraID);
    const speedLimitByTag = useSelector(getSpeedLimitByTag);

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        infraID={infraID}
        speedLimitByTag={speedLimitByTag}
      />
    );
  };
}

export function SpeedLimitByTagSelector({
  infraID,
  speedLimitByTag,
  dispatch,
  condensed = true,
}: SpeedLimitByTagSelectorProps) {
  const [speedLimitsTags, setSpeedLimitsTags] = useState(undefined);
  const [oldInfraID, setOldInfraID] = useState(infraID);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const getTagsListController = new AbortController();

  const getTagsList = async () => {
    try {
      const tagsList = await get(`/editoast/infra/${infraID}/speed_limit_tags/`);
      setSpeedLimitsTags(tagsList);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveTags'),
          message: `${e.message} : ${e.response && e.response.data.detail}`,
        })
      );
    }
  };

  useEffect(() => {
    // Check if infraID has changed to avoid clearing value on first mount
    if (infraID !== oldInfraID) {
      setSpeedLimitsTags(undefined);
      dispatch(updateSpeedLimitByTag(''));
      setOldInfraID(infraID);
    }
    getTagsList();
    return function cleanup() {
      getTagsListController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

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
