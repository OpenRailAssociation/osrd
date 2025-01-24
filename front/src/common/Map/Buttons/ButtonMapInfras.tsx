import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { GiRailway } from 'react-icons/gi';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useInfraID } from 'common/osrdContext';
import InfraSelector from 'modules/infra/components/InfraSelector';

const ButtonMapInfras = ({ isInEditor }: { isInEditor?: boolean }) => {
  const { openModal } = useModal();
  const infraID = useInfraID();
  const { t } = useTranslation('translation');
  return (
    <button
      type="button"
      title={t('Editor.nav.choose-infra')}
      className={cx('btn-rounded', 'btn-rounded-white', { 'btn-map-infras-blinking': !infraID })}
      onClick={() => openModal(<InfraSelector isInEditor={isInEditor} />, 'lg')}
    >
      <span className="sr-only">Infrastructures</span>
      <GiRailway />
    </button>
  );
};

export default ButtonMapInfras;
