import React from 'react';
import { useTranslation } from 'react-i18next';
import { GoZoomIn } from 'react-icons/go';
import Tipped from 'common/Tipped';

type ButtonZoomInProps = {
  zoomIn: () => void;
};

const ButtonZoomIn = ({ zoomIn }: ButtonZoomInProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button type="button" className="btn-rounded btn-rounded-white" onClick={() => zoomIn()}>
        <span className="sr-only">Zoom in</span>
        <GoZoomIn />
      </button>
      <span>{t('common.zoom-in')}</span>
    </Tipped>
  );
};

export default ButtonZoomIn;
