import React, { useContext } from 'react';
import { GiRailRoad } from 'react-icons/gi';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

export default function ButtonMapInfras() {
  const { openModal } = useContext(ModalContext);
  return (
    <button
      type="button"
      className="btn-rounded btn-rounded-white btn-map-infras"
      onClick={() => openModal(<InfraSelector modalOnly />, 'lg')}
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailRoad />
    </button>
  );
}
