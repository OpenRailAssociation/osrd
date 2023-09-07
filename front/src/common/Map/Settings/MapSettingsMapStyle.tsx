import React, { FC } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';

import picNormalMode from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import picDarkMode from 'assets/pictures/mapbuttons/mapstyle-dark.jpg';
import picBlueprint from 'assets/pictures/mapbuttons/mapstyle-blueprint.jpg';
import { updateMapStyle } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';

const MapSettingsMapStyle: FC<unknown> = () => {
  const { t } = useTranslation(['map-settings']);
  const { mapStyle } = useSelector(getMap);
  const dispatch = useDispatch();

  return (
    <div className="row ml-1">
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'normal' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('normal'))}
      >
        <img src={picNormalMode} alt="normal mode" />
        <span>{t('mapstyles.normal')}</span>
      </button>
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'dark' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('dark'))}
      >
        <img src={picDarkMode} alt="normal mode" />
        <span>{t('mapstyles.darkmode')}</span>
      </button>
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'blueprint' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('blueprint'))}
      >
        <img src={picBlueprint} alt="normal mode" />
        <span>{t('mapstyles.blueprint')}</span>
      </button>
    </div>
  );
};

export default MapSettingsMapStyle;
