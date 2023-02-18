import React from 'react';
import PropTypes from 'prop-types';

export default function ButtonMapKey(props) {
  const { toggleMapKey } = props;
  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-settings"
      onClick={toggleMapKey}
    >
      <span className="sr-only">Key</span>
      <i className="icons-circle-tooltip" />
    </button>
  );
}

ButtonMapKey.propTypes = {
  toggleMapKey: PropTypes.func.isRequired,
};
