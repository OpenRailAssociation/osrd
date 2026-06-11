import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { GiRailway } from 'react-icons/gi';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useInfraID } from 'common/osrdContext';
import InfraSelector from 'modules/infra/components/InfraSelector';

const ButtonMapInfras = ({ isInEditor }: { isInEditor?: boolean }) => {
  const infraID = useInfraID();
  const { openModal } = useModal();
  const { t } = useTranslation('translation');

  const openInfraSelectorModal = () => {
    openModal(<InfraSelector isInEditor={isInEditor} />, 'lg');
  };

  return (
    <button
      type="button"
      title={t('Editor.nav.choose-infra')}
      className={cx('btn-rounded', 'btn-rounded-white', { 'btn-map-infras-blinking': !infraID })}
      onClick={openInfraSelectorModal}
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailway />
    </button>
  );
};

export default ButtonMapInfras;
