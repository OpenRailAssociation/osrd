import React from 'react';
import { FaCompass } from 'react-icons/fa';

type ButtonResetViewportProps = {
  updateLocalViewport: () => void;
};

const ButtonResetViewport = ({ updateLocalViewport }: ButtonResetViewportProps) => (
  <button
    type="button"
    className="btn-rounded btn-rounded-white btn-map-resetviewport"
    onClick={updateLocalViewport}
  >
    <span className="sr-only">Reset north</span>
    <FaCompass />
  </button>
);

export default ButtonResetViewport;
