import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateSpeedLimitByTag } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import icon from 'assets/pictures/components/speedometer.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { getInfraID, getSpeedLimitByTag } from 'reducers/osrdconf/selectors';

export default function SpeedLimitByTagSelector() {
  const dispatch = useDispatch();
  const infraID = useSelector(getInfraID);
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const [speedLimitsTags, setSpeedLimitsTags] = useState(undefined);
  const [oldInfraID, setOldInfraID] = useState(infraID);
  const { t } = useTranslation(['osrdconf']);

  const getTagsListController = new AbortController();

  const getTagsList = async () => {
    try {
      const tagsList = await get(`/infra/${infraID}/speed_limit_tags/`);
      setSpeedLimitsTags(tagsList);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveTags'),
          message: `${e.message} : ${e.response && e.response.data.detail}`,
        })
      );
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    // Check if infraID has changed to avoid clearing value on first mount
    if (infraID !== oldInfraID) {
      setSpeedLimitsTags(undefined);
      dispatch(updateSpeedLimitByTag(undefined));
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
      <div className="osrd-config-item-container">
        <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
        <span className="text-muted">{t('speedLimitByTag')}</span>
        <SelectImprovedSNCF
          options={speedLimitsTags}
          onChange={(e) => dispatch(updateSpeedLimitByTag(e))}
          selectedValue={speedLimitByTag}
          sm
          withSearch
        />
      </div>
    </div>
  ) : null;
}
