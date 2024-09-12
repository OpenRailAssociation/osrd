import cx from 'classnames';
import { useTranslation } from 'react-i18next';

type MicroMacroSwitchProps = {
  isMacro: boolean;
  setIsMacro: (isMacro: boolean) => void;
};

const MicroMacroSwitch = ({ isMacro, setIsMacro }: MicroMacroSwitchProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  return (
    <div className="micro-macro-buttons">
      <button
        type="button"
        className={cx('micro-button', { active: !isMacro })}
        tabIndex={0}
        onClick={() => setIsMacro(false)}
      >
        {t('microscopic')}
      </button>
      <div className="micro-macro-separator" />
      <button
        type="button"
        className={cx('macro-button', { active: isMacro })}
        tabIndex={0}
        onClick={() => setIsMacro(true)}
      >
        {t('macroscopic')}
      </button>
    </div>
  );
};

export default MicroMacroSwitch;
