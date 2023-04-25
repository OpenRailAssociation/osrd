import React from 'react';

type ButtonMapSearchProps = {
  toggleMapSearch: () => void;
};

const ButtonMapSearch = ({ toggleMapSearch }: ButtonMapSearchProps) => (
  <button
    type="button"
    className="btn-rounded btn-rounded-white btn-map-search"
    onClick={toggleMapSearch}
  >
    <span className="sr-only">Search</span>
    <i className="icons-search" />
  </button>
);

export default ButtonMapSearch;
