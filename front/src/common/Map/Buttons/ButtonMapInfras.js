import React from 'react';
import { GiRailRoad } from 'react-icons/gi';
import PropTypes from 'prop-types';

export default function ButtonMapInfras(props) {
  const { toggleInfraSelector } = props;

  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-infras"
      onClick={toggleInfraSelector}
      data-toggle="modal"
      data-target="#infra-selector-modal-map"
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailRoad />
    </button>
  );
}

ButtonMapInfras.propTypes = {
  toggleInfraSelector: PropTypes.func.isRequired,
};
