import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateSpeedLimitByTag } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import icon from 'assets/pictures/speedometer.svg';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';

export default function SpeedLimitByTagSelector() {
  const dispatch = useDispatch();
  const [speedLimitsTags, setSpeedLimitsTags] = useState(undefined);
  const { infraID, speedLimitByTag } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['osrdconf']);

  const getTagsListController = new AbortController();
  const getTagsListSignal = getTagsListController.signal;

  const getTagsList = async (zoom, params) => {
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
    setSpeedLimitsTags(undefined);
    dispatch(updateSpeedLimitByTag(undefined));
    getTagsList();
    return function cleanup() {
      setSpeedLimitsTags(undefined);
      dispatch(updateSpeedLimitByTag(undefined));
      getTagsListController.abort();
    };
  }, [infraID]);

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container">
        <div className="h2 mb-0">
          <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
          <span className="text-muted">{t('speedLimitByTag')}</span>
          {speedLimitsTags !== undefined ? (
            <SelectImprovedSNCF
              options={speedLimitsTags}
              onChange={(e) => dispatch(updateSpeedLimitByTag(e))}
              selectedValue={speedLimitByTag}
              sm
              withSearch
            />
          ) : (
            <span className="ml-3">
              <DotsLoader />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
