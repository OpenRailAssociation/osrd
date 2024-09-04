import type { CellProps } from 'react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import { NO_BREAK_SPACE } from 'utils/strings';

import type { TimeExtraDays } from './types';

type ReadOnlyTimeProps = CellProps<TimeExtraDays | undefined, string>;

const ReadOnlyTime = ({ rowData }: ReadOnlyTimeProps) => {
  const { time, daySinceDeparture, dayDisplayed } = rowData || {};
  if (!time) {
    return null;
  }
  const { t } = useTranslation('timesStops');
  const fullString =
    daySinceDeparture !== undefined && dayDisplayed
      ? `${time}${NO_BREAK_SPACE}${t('dayCounter', { count: daySinceDeparture })}`
      : time;
  return <div className="read-only-time">{fullString}</div>;
};

export default ReadOnlyTime;
