import React from 'react';

type ButtonMapSettingsProps = {
  toggleMapSettings: () => void;
};

const ButtonMapSettings = ({ toggleMapSettings }: ButtonMapSettingsProps) => (
  <button
    type="button"
    className="btn-rounded btn-rounded-white btn-map-settings"
    onClick={toggleMapSettings}
  >
    <span className="sr-only">Settings</span>
    <i className="icons-admin" />
  </button>
);

export default ButtonMapSettings;
