import React from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import picBlueprint from 'assets/pictures/mapbuttons/mapstyle-blueprint.jpg';
import picDarkMode from 'assets/pictures/mapbuttons/mapstyle-dark.jpg';
import picMinimalMode from 'assets/pictures/mapbuttons/mapstyle-minimal.jpg';
import picNormalMode from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import { updateMapStyle } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

const MapSettingsMapStyle = () => {
  const { t } = useTranslation(['map-settings']);
  const { mapStyle } = useSelector(getMap);
  const dispatch = useAppDispatch();

  return (
    <div className="row ml-1 mapstyle">
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'normal' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('normal'))}
      >
        <img src={picNormalMode} alt="normal mode" />
        <span>{t('mapstyles.normal')}</span>
      </button>
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'minimal' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('minimal'))}
      >
        <img src={picMinimalMode} alt="minimal mode" />
        <span>{t('mapstyles.minimal')}</span>
      </button>
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'dark' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('dark'))}
      >
        <img src={picDarkMode} alt="dark mode" />
        <span>{t('mapstyles.darkmode')}</span>
      </button>
      <button
        className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === 'blueprint' && 'active')}
        type="button"
        onClick={() => dispatch(updateMapStyle('blueprint'))}
      >
        <img src={picBlueprint} alt="blueprint mode" />
        <span>{t('mapstyles.blueprint')}</span>
      </button>
    </div>
  );
};

export default MapSettingsMapStyle;
