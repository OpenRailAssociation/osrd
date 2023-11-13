import React from 'react';
import { GoZoomOut } from 'react-icons/go';
import { useTranslation } from 'react-i18next';
import Tipped from 'applications/editor/components/Tipped';

type ButtonZoomInProps = {
  zoomOut: () => void;
};

const ButtonZoomIn = ({ zoomOut }: ButtonZoomInProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button type="button" className="btn-rounded btn-rounded-white" onClick={() => zoomOut()}>
        <span className="sr-only">Zoom in</span>
        <GoZoomOut />
      </button>
      <span>{t('common.zoom-out')}</span>
    </Tipped>
  );
};

export default ButtonZoomIn;
