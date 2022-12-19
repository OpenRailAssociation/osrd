import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateMapStyle } from 'reducers/map';
import picNormalMode from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import picDarkMode from 'assets/pictures/mapbuttons/mapstyle-dark.jpg';
import picBlueprint from 'assets/pictures/mapbuttons/mapstyle-blueprint.jpg';

export default function MapSettingsMapStyle() {
  const { t } = useTranslation(['map-settings']);
  const { mapStyle } = useSelector((state) => state.map);
  const dispatch = useDispatch();
  return (
    <div className="row ml-1">
      <button
        className={`col-xs-4 mb-2 mapstyle-style-select ${mapStyle === 'normal' ? 'active' : null}`}
        type="button"
        onClick={() => dispatch(updateMapStyle('normal'))}
      >
        <img src={picNormalMode} alt="normal mode" />
        <span>{t('mapstyles.normal')}</span>
      </button>
      <button
        className={`col-xs-4 mb-2 mapstyle-style-select ${mapStyle === 'dark' ? 'active' : null}`}
        type="button"
        onClick={() => dispatch(updateMapStyle('dark'))}
      >
        <img src={picDarkMode} alt="normal mode" />
        <span>{t('mapstyles.darkmode')}</span>
      </button>
      <button
        className={`col-xs-4 mb-2 mapstyle-style-select ${
          mapStyle === 'blueprint' ? 'active' : null
        }`}
        type="button"
        onClick={() => dispatch(updateMapStyle('blueprint'))}
      >
        <img src={picBlueprint} alt="normal mode" />
        <span>{t('mapstyles.blueprint')}</span>
      </button>
    </div>
  );
}
