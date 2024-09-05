import { ZoomOut } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import Tipped from 'common/Tipped';

type ButtonZoomInProps = {
  zoomOut: () => void;
};

const ButtonZoomIn = ({ zoomOut }: ButtonZoomInProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button type="button" className="btn-rounded btn-rounded-white" onClick={() => zoomOut()}>
        <span className="sr-only">Zoom in</span>
        <ZoomOut size="lg" />
      </button>
      <span>{t('common.zoom-out')}</span>
    </Tipped>
  );
};

export default ButtonZoomIn;
