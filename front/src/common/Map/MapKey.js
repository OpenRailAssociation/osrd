import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

export default function MapSettings(props) {
  const {
    active, toggleMapKey,
  } = props;
  const { t } = useTranslation(['translation', 'map-key']);
  return (
    <div className={`map-modal${active ? ' active' : ''}`}>
      <div className="h2">
        {t('map-key:keyTitle')}
      </div>
      COUCOU
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
