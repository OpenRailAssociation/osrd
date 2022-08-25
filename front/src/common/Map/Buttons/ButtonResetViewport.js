import React from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { FaCompass } from 'react-icons/fa';

export default function ButtonResetViewport(props) {
  const { updateLocalViewport } = props;
  const { viewport } = useSelector((state) => state.map);

  const resetOrientation = () => {
    const newViewport = {
      ...viewport,
      bearing: 0,
      pitch: 0,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    };
    updateLocalViewport(newViewport, 1000);
  };

  return (
    <button type="button" className="btn-rounded btn-rounded-white btn-map-resetviewport" onClick={resetOrientation}>
      <span className="sr-only">Reset north</span>
      <FaCompass />
    </button>
  );
}

ButtonResetViewport.propTypes = {
  updateLocalViewport: PropTypes.func.isRequired,
};
