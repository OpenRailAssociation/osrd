import React from 'react';
import PropTypes from 'prop-types';

export default function ButtonMapSettings(props) {
  const { toggleMapSettings } = props;
  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-settings"
      onClick={toggleMapSettings}
    >
      <span className="sr-only">Settings</span>
      <i className="icons-admin" />
    </button>
  );
}

ButtonMapSettings.propTypes = {
  toggleMapSettings: PropTypes.func.isRequired,
};
