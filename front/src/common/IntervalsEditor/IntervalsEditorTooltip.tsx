import { useTranslation } from 'react-i18next';

import type { IntervalItem } from './types';

interface IntervalsEditorTooltip {
  item: IntervalItem;
  point: number;
}

const IntervalsEditorTooltip = ({ item, point }: IntervalsEditorTooltip) => {
  const { t } = useTranslation('common/common');
  return (
    <div className="linear-metadata-tooltip">
      <div className="header">{point && <span>{Math.round(point)}</span>}</div>
      <div className="content">
        <div>
          <span className="mr-3">{t('begin')}</span>
          {Math.round(item.begin)}
        </div>
        <div>
          <span className="mr-3">{t('end')}</span>
          {Math.round(item.end)}
        </div>
        <div>
          <span className="mr-3">{t('value')}</span>
          {item.value}
        </div>
      </div>
    </div>
  );
};

export default IntervalsEditorTooltip;
