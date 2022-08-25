import React from 'react';
import PropTypes from 'prop-types';

export default function ButtonMapSettings(props) {
  const { toggleMapSearch } = props;
  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-search"
      onClick={toggleMapSearch}
    >
      <span className="sr-only">Search</span>
      <i className="icons-search" />
    </button>
  );
}

ButtonMapSettings.propTypes = {
  toggleMapSearch: PropTypes.func.isRequired,
};
