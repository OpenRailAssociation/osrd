import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import picDarkMode from 'assets/pictures/mapbuttons/mapstyle-dark.jpg';
import picMinimalMode from 'assets/pictures/mapbuttons/mapstyle-minimal.jpg';
import picNormalMode from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import { useMapSettingsActions } from 'reducers/commonMap';
import type { MapStyle } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

const MapSettingsMapStyle = ({ mapStyle }: { mapStyle: MapStyle }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { updateMapSettings } = useMapSettingsActions();
  const styles = [
    { key: 'normal', image: picNormalMode, label: t('mapSettings.mapstyles.normal') },
    { key: 'minimal', image: picMinimalMode, label: t('mapSettings.mapstyles.minimal') },
    { key: 'dark', image: picDarkMode, label: t('mapSettings.mapstyles.darkmode') },
  ] as const;

  return (
    <div className="row ml-1 mapstyle">
      {styles.map(({ key, image, label }) => (
        <button
          key={key}
          className={cx('col-xs-4 mb-2 mapstyle-style-select', mapStyle === key && 'active')}
          type="button"
          onClick={() => dispatch(updateMapSettings({ mapStyle: key }))}
        >
          <img src={image} alt={`${key} mode`} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default MapSettingsMapStyle;
