import React from 'react';
import { GiRailRoad } from 'react-icons/gi';
import PropTypes from 'prop-types';

export default function ButtonMapInfras(props) {
  const { modalID } = props;

  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-infras"
      data-toggle="modal"
      data-target={`#${modalID}`}
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailRoad />
    </button>
  );
}

ButtonMapInfras.propTypes = {
  modalID: PropTypes.string.isRequired,
};
