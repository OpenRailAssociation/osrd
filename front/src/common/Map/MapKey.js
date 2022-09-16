import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import colors from 'common/Map/Consts/colors.ts';
import 'common/Map/MapKey.scss';

export default function MapSettings(props) {
  const { active, toggleMapKey } = props;
  const { mapStyle } = useSelector((state) => state.map);
  const { t } = useTranslation(['translation', 'map-key']);
  return (
    <div className={`map-modal map-modal-dark ${active ? 'active' : ''}`}>
      <div className="h2 text-light">{t('map-key:keyTitle')}</div>

      <div className="row">
        <div className="col-lg-6">
          <div className="mapkey">
            <div className="mapkey-title">{t('map-key:speedlimit')}</div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v300" />
              </div>
              <div className="mapkey-text"> &gt; 220km/h</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v200" />
              </div>
              <div className="mapkey-text">161km/h - 220km/h</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v160" />
              </div>
              <div className="mapkey-text">140km/h - 160km/h</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v100" />
              </div>
              <div className="mapkey-text">100km/h - 139km/h</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v60" />
              </div>
              <div className="mapkey-text">61km/h - 99km/h</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v30" />
              </div>
              <div className="mapkey-text">31km/h - 60km/h</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i className="mapkey-line mapkey-v0" />
              </div>
              <div className="mapkey-text">1km/h - 30km/h</div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="mapkey">
            <div className="mapkey-title">{t('map-key:catenaries')}</div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color25000V} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">
                25000V &nbsp;
                {t('map-key:alternatingCurrent')}
              </div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color15000V1623} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">15000V 16 2/3</div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color3000V} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">
                3000V &nbsp;
                {t('map-key:directCurrent')}
              </div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color1500V} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">
                1500V &nbsp;
                {t('map-key:directCurrent')}
              </div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color850V} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">
                850V &nbsp;
                {t('map-key:directCurrent')}
              </div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color800V} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">
                800V &nbsp;
                {t('map-key:directCurrent')}
              </div>
            </div>
            <div className="mapkey-item">
              <div className="mapkey-icon">
                <i
                  className="powerline"
                  style={{
                    background: `repeating-linear-gradient(to right, ${colors[mapStyle].powerline.color750V} 20px, #333 22px, #333 24px)`,
                  }}
                />
              </div>
              <div className="mapkey-text">
                750V &nbsp;
                {t('map-key:directCurrent')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 d-flex flex-row-reverse w-100">
        <button className="btn btn-secondary btn-sm" type="button" onClick={toggleMapKey}>
          {t('translation:common.close')}
        </button>
      </div>
    </div>
  );
}

MapSettings.propTypes = {
  active: PropTypes.bool,
  toggleMapKey: PropTypes.func.isRequired,
};

MapSettings.defaultProps = {
  active: false,
};
