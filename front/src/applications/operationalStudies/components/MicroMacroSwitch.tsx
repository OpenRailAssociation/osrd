import cx from 'classnames';
import { useTranslation } from 'react-i18next';

type MicroMacroSwitchProps = {
  isMacro: boolean;
  setIsMacro: (isMacro: boolean) => void;
};

const MicroMacroSwitch = ({ isMacro, setIsMacro }: MicroMacroSwitchProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  return (
    <div className="tabs-container">
      <div className="tabs">
        <div
          className={cx('tab', { active: !isMacro })}
          role="button"
          tabIndex={0}
          onClick={() => setIsMacro(false)}
        >
          {t('microscopic')}
        </div>
        <div
          className={cx('tab', { active: isMacro })}
          role="button"
          tabIndex={0}
          onClick={() => setIsMacro(true)}
        >
          {t('macroscopic')}
        </div>
      </div>
    </div>
  );
};

export default MicroMacroSwitch;
