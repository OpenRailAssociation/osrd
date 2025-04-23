import { useTranslation } from 'react-i18next';
import { TbZoomCancel, TbZoomIn, TbZoomOut } from 'react-icons/tb';

import { getZoomedViewBox } from 'common/IntervalsDataViz/data';

import type { IntervalItem } from './types';

type ZoomButtonProps = {
  data: IntervalItem[];
  setViewBox: (viewBox: [number, number] | null) => void;
  viewBox: [number, number] | null;
};

const ZoomButtons = ({ data, setViewBox, viewBox }: ZoomButtonProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="zoom-horizontal">
        <button
          aria-label={t('common.zoom-in')}
          title={t('common.zoom-in')}
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'IN'))}
        >
          <TbZoomIn />
        </button>
        <button
          aria-label={t('common.reset')}
          title={t('common.reset')}
          type="button"
          disabled={viewBox === null}
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setViewBox(null)}
        >
          <TbZoomCancel />
        </button>
        <button
          aria-label={t('common.zoom-out')}
          title={t('common.zoom-out')}
          type="button"
          disabled={viewBox === null}
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'OUT'))}
        >
          <TbZoomOut />
        </button>
      </div>
    </div>
  );
};

export default ZoomButtons;
