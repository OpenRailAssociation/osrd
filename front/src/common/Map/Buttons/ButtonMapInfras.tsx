import React from 'react';
import { GiRailway } from 'react-icons/gi';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { useSelector } from 'react-redux';

const ButtonMapInfras = () => {
  const { openModal } = useModal();
  const infraID = useSelector(getInfraID);
  return (
    <button
      type="button"
      className={`btn-rounded btn-rounded-white ${infraID ? '' : 'btn-map-infras-blinking'}`}
      onClick={() => openModal(<InfraSelector isModalOnly />, 'lg')}
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailway />
    </button>
  );
};

export default ButtonMapInfras;
