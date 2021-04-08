import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateMapStyle } from 'reducers/map';
import picNormalMode from 'assets/pictures/mapstyle-normal.jpg';
import picDarkMode from 'assets/pictures/mapstyle-dark.jpg';
import picBlueprint from 'assets/pictures/mapstyle-blueprint.jpg';

export default function MapSettingsMapStyle() {
  const { t } = useTranslation();
  const { mapStyle } = useSelector((state) => state.map);
  const dispatch = useDispatch();
  return (
    <div className="row">
      <button
        className={`col-xs-4 mb-2 mapstyle-style-select ${mapStyle === 'normal' ? 'active' : null}`}
        type="button"
        onClick={() => dispatch(updateMapStyle('normal'))}
      >
        <img src={picNormalMode} alt="normal mode" />
        <span>{t('Map.mapstyles.normal')}</span>
      </button>
      <button
        className={`col-xs-4 mb-2 mapstyle-style-select ${mapStyle === 'dark' ? 'active' : null}`}
        type="button"
        onClick={() => dispatch(updateMapStyle('dark'))}
      >
        <img src={picDarkMode} alt="normal mode" />
        <span>{t('Map.mapstyles.darkmode')}</span>
      </button>
      <button
        className={`col-xs-4 mb-2 mapstyle-style-select ${mapStyle === 'blueprint' ? 'active' : null}`}
        type="button"
        onClick={() => dispatch(updateMapStyle('blueprint'))}
      >
        <img src={picBlueprint} alt="normal mode" />
        <span>{t('Map.mapstyles.blueprint')}</span>
      </button>
    </div>
  );
}
