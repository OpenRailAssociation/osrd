import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';

type MicroMacroSwitchProps = {
  isMacro: boolean;
  setIsMacro: (isMacro: boolean) => void;
};

const MicroMacroSwitch = ({ isMacro, setIsMacro }: MicroMacroSwitchProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  const infraData = useInfraStatus();
  return (
    <div className="micro-macro-buttons">
      <button
        type="button"
        className={cx('micro-button', { active: !isMacro })}
        tabIndex={0}
        onClick={() => setIsMacro(false)}
        disabled={!infraData.isInfraLoaded}
      >
        {t('microscopic')}
      </button>
      <div className="micro-macro-separator" />
      <button
        type="button"
        className={cx('macro-button', { active: isMacro })}
        tabIndex={0}
        onClick={() => setIsMacro(true)}
        disabled={!infraData.isInfraLoaded}
      >
        {t('macroscopic')}
      </button>
    </div>
  );
};

export default MicroMacroSwitch;
