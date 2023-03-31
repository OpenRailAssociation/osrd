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

interface getListByTagFn {
  (): Promise<string[]>;
}

type SpeedLimitByTagSelectorProps = {
  condensed?: boolean;
  infraID?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  speedLimitByTag?: any;
  dispatch?: Dispatch;
  getTagsList?: getListByTagFn;
};

function withOSRDData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const dispatch = useDispatch();
    const infraID = useSelector(getInfraID);
    const speedLimitByTag = useSelector(getSpeedLimitByTag);
    const getTagsList = async (): Promise<T> => {
      let tagList = [];
      try {
        tagList = await get(`/editoast/infra/${infraID}/speed_limit_tags/`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        dispatch(
          setFailure({
            name: t('errorMessages.unableToRetrieveTags'),
            message: `${e.message} : ${e.response && e.response.data.detail}`,
          })
        );
      }
      return tagList;
    };
    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        infraID={infraID}
        speedLimitByTag={speedLimitByTag}
        getTagsList={getTagsList}
      />
    );
  };
}

export function SpeedLimitByTagSelector({
  infraID,
  speedLimitByTag,
  dispatch = () => {},
  getTagsList = async (): Promise<Array<string>> => [],
  condensed = false,
}: SpeedLimitByTagSelectorProps) {
  const [speedLimitsTags, setSpeedLimitsTags] = useState<any[] | undefined>(undefined);
  const [oldInfraID, setOldInfraID] = useState(infraID);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const getTagsListController = new AbortController();

  useEffect(() => {
    // Check if infraID has changed to avoid clearing value on first mount
    if (infraID !== oldInfraID) {
      setSpeedLimitsTags([]);
      dispatch(updateSpeedLimitByTag(''));
      setOldInfraID(infraID);
    }
    getTagsList().then((tags) => setSpeedLimitsTags(tags));

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
