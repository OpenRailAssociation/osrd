import { CompassCardinal, CompassNeedle } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import Tipped from 'common/Tipped';

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
        <span className="compass-needle" style={rotationStyle}>
          <CompassNeedle size="lg" />
        </span>
        <span className="compass-cardinal">
          <CompassCardinal size="lg" />
        </span>
      </button>
      <span>{t('common.reset-north')}</span>
    </Tipped>
  );
};

export default ButtonResetViewport;
