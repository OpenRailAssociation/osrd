import React from 'react';
import { GiRailRoad } from 'react-icons/gi';
import PropTypes from 'prop-types';

export default function ButtonMapTimetables(props) {
  const { modalID } = props;

  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-timetables"
      data-toggle="modal"
      data-target={`#${modalID}`}
    >
      <span className="sr-only">Grilles Horaires</span>
      <GiRailRoad />
    </button>
  );
}

ButtonMapTimetables.propTypes = {
  modalID: PropTypes.string.isRequired,
};
