import { useTranslation } from 'react-i18next';

import { colors, type Theme } from 'common/Map/theme';
import { useMapSettings } from 'reducers/commonMap';

import { electrificationMapKey, type MapKeyProps, speedLimitMapKey } from './const';
import MapModalHeader from './MapModalHeader';

const MapSettings = ({ closeMapKeyPopUp }: MapKeyProps) => {
  const { t } = useTranslation();
  const { mapStyle } = useMapSettings();
  const speedLimits = speedLimitMapKey.map((key) => (
    <div className="mapkey-item" key={key.text}>
      <div className="mapkey-icon">
        <i className={`mapkey-line mapkey-${key.speed}`} />
      </div>
      <div className="mapkey-text">{key.text}</div>
    </div>
  ));

  const electrifications = electrificationMapKey.map((key) => (
    <div className="mapkey-item" key={key.text}>
      <div className="mapkey-icon">
        <i
          className="powerline"
          style={{
            background: `repeating-linear-gradient(to right, ${
              colors[mapStyle].powerline[key.color as keyof Theme['powerline']]
            } 20px, #333 22px, #333 24px)`,
          }}
        />
      </div>
      <div className="mapkey-text">
        {`${key.text} ${key.current && t(`mapKey.${key.current}`)}`}
      </div>
    </div>
  ));

  return (
    <div className="map-modal map-modal-dark">
      <MapModalHeader closeAction={closeMapKeyPopUp} title={t('mapKey.keyTitle')} textLight />
      <div className="row">
        <div className="col-lg-6">
          <div className="mapkey">
            <div className="mapkey-title">{t('mapKey.speedlimit')}</div>
            {speedLimits}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="mapkey">
            <div className="mapkey-title">{t('mapKey.electrifications')}</div>
            {electrifications}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="mapkey">
            <div className="mapkey-title">{t('mapKey.neutral_sections')}</div>
            <div className="mapkey-item" key="lower_pantograph">
              <div className="mapkey-icon">
                <i
                  className="mapkey-line"
                  style={{ background: colors[mapStyle].neutral_sections.lower_pantograph }}
                />
              </div>
              <div className="mapkey-text">{t('mapKey.lower_pantograph')}</div>
            </div>
            <div className="mapkey-item" key="switch_off">
              <div className="mapkey-icon">
                <i
                  className="mapkey-line"
                  style={{ background: colors[mapStyle].neutral_sections.switch_off }}
                />
              </div>
              <div className="mapkey-text">{t('mapKey.switch_off')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapSettings;
