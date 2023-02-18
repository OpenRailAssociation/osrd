import React, { useContext } from 'react';
import { GiRailway } from 'react-icons/gi';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { useSelector } from 'react-redux';

export default function ButtonMapInfras() {
  const { openModal } = useContext(ModalContext);
  const infraID = useSelector(getInfraID);
  return (
    <button
      type="button"
      className={`btn-rounded btn-rounded-white ${infraID ? '' : 'btn-map-infras-blinking'}`}
      onClick={() => openModal(<InfraSelector modalOnly />, 'lg')}
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailway />
    </button>
  );
}
