import React from 'react';
import { GiRailway } from 'react-icons/gi';
import InfraSelector from 'modules/infra/components/InfraSelector';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import Tipped from 'applications/editor/components/Tipped';
import { useInfraID } from 'common/osrdContext';

const ButtonMapInfras = () => {
  const { openModal } = useModal();
  const infraID = useInfraID();
  const { t } = useTranslation('translation');

  return (
    <Tipped mode="left">
      <button
        type="button"
        className={cx('btn-rounded', 'btn-rounded-white', { 'btn-map-infras-blinking': !infraID })}
        onClick={() => openModal(<InfraSelector isModalOnly />, 'lg')}
      >
        <span className="sr-only">Infrastructures</span>
        <GiRailway />
      </button>
      <span>{t('Editor.nav.choose-infra')} </span>
    </Tipped>
  );
};

export default ButtonMapInfras;
