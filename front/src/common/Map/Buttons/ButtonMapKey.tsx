import React from 'react';
import { useTranslation } from 'react-i18next';
import { BsQuestionCircle } from 'react-icons/bs';
import Tipped from 'common/Tipped';

type ButtonMapKeyProps = {
  toggleMapKey: () => void;
};

const ButtonMapKey = ({ toggleMapKey }: ButtonMapKeyProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button
        type="button"
        className="btn-rounded btn-rounded-white btn-map-settings"
        onClick={toggleMapKey}
      >
        <span className="sr-only">Key</span>
        <BsQuestionCircle />
      </button>
      <span>{t('common.help-legend')} </span>
    </Tipped>
  );
};

export default ButtonMapKey;
