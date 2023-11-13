import React from 'react';
import { useTranslation } from 'react-i18next';

import { FaRegCompass } from 'react-icons/fa';
import Tipped from 'applications/editor/components/Tipped';

type ButtonResetViewportProps = {
  updateLocalViewport: () => void;
};

const ButtonResetViewport = ({ updateLocalViewport }: ButtonResetViewportProps) => {
  const { t } = useTranslation('translation');

  return (
    <Tipped mode="left">
      <button
        type="button"
        className="btn-rounded btn-rounded-white btn-map-resetviewport"
        onClick={updateLocalViewport}
      >
        <span className="sr-only">Reset north</span>
        <FaRegCompass />
      </button>
      <span>{t('common.reset-north')}</span>
    </Tipped>
  );
};

export default ButtonResetViewport;
