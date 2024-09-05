import { ZoomIn } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import Tipped from 'common/Tipped';

type ButtonZoomInProps = {
  zoomIn: () => void;
};

const ButtonZoomIn = ({ zoomIn }: ButtonZoomInProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button type="button" className="btn-rounded btn-rounded-white" onClick={() => zoomIn()}>
        <span className="sr-only">{t('common.zoom-in')}</span>
        <ZoomIn size="lg" />
      </button>
      <span>{t('common.zoom-in')}</span>
    </Tipped>
  );
};

export default ButtonZoomIn;
