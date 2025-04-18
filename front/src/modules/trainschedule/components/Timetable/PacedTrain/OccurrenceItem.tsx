import { Moon } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import type { TrainId } from 'reducers/osrdconf/types';
import { isException, isOccurrenceId } from 'utils/trainId';

import OccurrenceIndicator from './OccurrenceIndicator';
import type { Occurrence } from '../types';
import { formatTrainDuration, roundAndFormatToNearestMinute } from '../utils';

const ConsecutiveDayDateDisplay = ({
  departureTime,
  nextDepartureTime,
}: {
  departureTime: Date;
  nextDepartureTime: Date;
}) => (
  <div className="consecutive-day-display">
    <div>
      <div className="date-display before-midnight">{dayjs(departureTime).format('DD')}</div>
      <div className="date-display after-midnight">{dayjs(nextDepartureTime).format('DD')}</div>
    </div>
    <div className="date-display">/{dayjs(nextDepartureTime).format('MM')}</div>
  </div>
);

type OccurrenceItemProps = {
  occurrence: Occurrence;
  isSelected: boolean;
  nextOccurrence?: Occurrence;
  selectOccurrence: (occurrence: TrainId) => void;
};

const OccurrenceItem = ({
  occurrence,
  isSelected,
  nextOccurrence,
  selectOccurrence,
}: OccurrenceItemProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
  const { trainName, rollingStock, startTime } = occurrence;
  const isAfterMidnight =
    occurrence.isValid && dayjs(occurrence.arrivalTime).isAfter(occurrence.startTime, 'day');
  const isNextAfterMidnight = nextOccurrence
    ? dayjs(nextOccurrence.startTime).isAfter(occurrence.startTime, 'day')
    : false;

  return (
    <div
      data-testid="occurrence-item"
      className={cx('occurrence-item', {
        'after-midnight': isAfterMidnight,
        'next-after-midnight': isNextAfterMidnight,
        selected: isSelected,
      })}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isOccurrenceId(occurrence.id)) selectOccurrence(occurrence.id);
      }}
    >
      <div className="main">
        <OccurrenceIndicator occurrence={occurrence} />
        <div className="occurrence-item-name">
          <span title={trainName}>{trainName}</span>
        </div>
        <div className="rolling-stock">
          {rollingStock && <RollingStock2Img rollingStock={rollingStock} />}
        </div>

        {occurrence.isValid && (
          <div className="occurrence-item-horaries">
            <div className="status-icon after-midnight">
              {isAfterMidnight && <Moon iconColor="rgba(33, 100, 130, 0.7)" />}
            </div>
            <div className="occurrence-item-time departure-time">
              {roundAndFormatToNearestMinute(startTime)}
            </div>
            <div className="occurrence-item-time arrival-time">
              {roundAndFormatToNearestMinute(occurrence.arrivalTime)}
            </div>
          </div>
        )}
        {nextOccurrence && isNextAfterMidnight && (
          <ConsecutiveDayDateDisplay
            departureTime={startTime}
            nextDepartureTime={nextOccurrence?.startTime}
          />
        )}
      </div>

      {isException(occurrence) && occurrence.isValid && (
        <div className="more-info">
          <div className="more-info-left">
            {/* TODO : add a category span in https://github.com/OpenRailAssociation/osrd/issues/11542 */}
            <span className="more-info-item">
              {t('timetable.stopsCount', { count: occurrence.stopsCount })}
            </span>
            <span className="more-info-item">{occurrence.pathLength}</span>
            <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
              {occurrence.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          {occurrence.duration && (
            <div className="duration-time">
              <span data-testid="train-duration">
                {formatTrainDuration(occurrence.duration.ms)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OccurrenceItem;
