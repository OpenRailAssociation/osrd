import React from 'react';
import { useTranslation } from 'react-i18next';

import compass_needle_24 from 'assets/pictures/layersicons/compass_needle_24.svg';
import compass_cardinal_24 from 'assets/pictures/layersicons/compass_cardinal_24.svg';
import Tipped from 'applications/editor/components/Tipped';

type ButtonResetViewportProps = {
  updateLocalViewport: () => void;
  bearing: number;
};

const ButtonResetViewport = ({ updateLocalViewport, bearing }: ButtonResetViewportProps) => {
  const { t } = useTranslation('translation');

  const rotationStyle = {
    transform: `translate(-40%, 0) rotate(${-bearing}deg)`,
    transformOrigin: 'center',
  };

  return (
    <Tipped mode="left">
      <button
        type="button"
        className="btn-rounded btn-rounded-white btn-map-resetviewport"
        onClick={updateLocalViewport}
      >
        <span className="sr-only">Reset north</span>
        <div className="compass-container">
          <img
            src={compass_needle_24}
            alt="Compass Needle"
            style={rotationStyle}
            className="compass-needle z-2"
          />
          <img src={compass_cardinal_24} alt="Compass Cardinal" className="compass-cardinal z-3" />
        </div>
      </button>
      <span>{t('common.reset-north')}</span>
    </Tipped>
  );
};

export default ButtonResetViewport;
