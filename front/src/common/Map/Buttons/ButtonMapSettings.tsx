import React from 'react';
import { useTranslation } from 'react-i18next';

import { BsSliders2 } from 'react-icons/bs';
import Tipped from 'applications/editor/components/Tipped';

type ButtonMapSettingsProps = {
  toggleMapSettings: () => void;
};

const ButtonMapSettings = ({ toggleMapSettings }: ButtonMapSettingsProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button
        type="button"
        className="btn-rounded btn-rounded-white btn-map-settings"
        onClick={toggleMapSettings}
      >
        <span className="sr-only">Settings</span>
        <BsSliders2 />
      </button>
      <span>{t('Editor.nav.toggle-layers')}</span>
    </Tipped>
  );
};

export default ButtonMapSettings;
