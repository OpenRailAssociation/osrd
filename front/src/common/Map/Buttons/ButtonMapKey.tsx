import React from 'react';

type ButtonMapKeyProps = {
  toggleMapKey: () => void;
};

const ButtonMapKey = ({ toggleMapKey }: ButtonMapKeyProps) => (
  <button
    type="button"
    className="btn-rounded btn-rounded-white btn-map-settings"
    onClick={toggleMapKey}
  >
    <span className="sr-only">Key</span>
    <i className="icons-circle-tooltip" />
  </button>
);

export default ButtonMapKey;
