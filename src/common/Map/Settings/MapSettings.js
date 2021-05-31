import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

export default function MapSettings(props) {
  const {
    active, children, toggleMapSettings,
  } = props;
  const { t } = useTranslation();
  return (
    <div className={`map-modal${active ? ' active' : ''}`}>
      <div className="h2">
        {t('osrd.map.mapSettings')}
      </div>
      {children}
      <div className="mt-2 d-flex flex-row-reverse w-100">
        <button className="btn btn-secondary btn-sm" type="button" onClick={toggleMapSettings}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

MapSettings.propTypes = {
  active: PropTypes.bool,
  children: PropTypes.array.isRequired,
  toggleMapSettings: PropTypes.func.isRequired,
};

MapSettings.defaultProps = {
  active: false,
};
