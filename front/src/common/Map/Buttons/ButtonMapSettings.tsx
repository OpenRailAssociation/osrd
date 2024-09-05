import { Sliders } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import Tipped from 'common/Tipped';

type ButtonMapSettingsProps = {
  toggleMapSettings: () => void;
};

const ButtonMapSettings = ({ toggleMapSettings }: ButtonMapSettingsProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button
        data-testid="button-map-settings"
        type="button"
        className="btn-rounded btn-rounded-white btn-map-settings"
        onClick={toggleMapSettings}
      >
        <span className="sr-only">Settings</span>
        <Sliders size="lg" />
      </button>
      <span>{t('Editor.nav.toggle-layers')}</span>
    </Tipped>
  );
};

export default ButtonMapSettings;
