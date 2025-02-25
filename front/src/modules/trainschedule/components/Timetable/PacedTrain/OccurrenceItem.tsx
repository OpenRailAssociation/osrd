import { Dot, Moon } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';

import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';

import type { Occurrence } from '../types';

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
};

const OccurrenceItem = ({ occurrence, isSelected, nextOccurrence }: OccurrenceItemProps) => {
  const { trainName, rollingStock, startTime, arrivalTime } = occurrence;
  const isAfterMidnight = dayjs(occurrence.arrivalTime).isAfter(occurrence.startTime, 'day');
  const isNextAfterMidnight = nextOccurrence
    ? dayjs(nextOccurrence.startTime).isAfter(occurrence.startTime, 'day')
    : false;

  return (
    <div
      className={cx('occurrence-item', {
        'after-midnight': isAfterMidnight,
        'next-after-midnight': isNextAfterMidnight,
        selected: isSelected,
      })}
    >
      <div className="occurrence-item-dot">
        <Dot variant="fill" />
      </div>
      <div className="occurrence-item-name" title={trainName}>
        {trainName}
      </div>
      <div className="rolling-stock">
        {rollingStock && <RollingStock2Img rollingStock={rollingStock} />}
      </div>

      <div className="occurrence-item-horaries">
        <div className="status-icon after-midnight">
          {isAfterMidnight && <Moon iconColor="rgba(33, 100, 130, 0.7)" />}
        </div>
        <div className="occurrence-item-time departure-time">
          {dayjs(startTime).format('HH:mm')}
        </div>
        <div className="occurrence-item-time arrival-time">
          {dayjs(arrivalTime).format('HH:mm')}
        </div>
      </div>
      {nextOccurrence && isNextAfterMidnight && (
        <ConsecutiveDayDateDisplay
          departureTime={startTime}
          nextDepartureTime={nextOccurrence?.startTime}
        />
      )}
    </div>
  );
};

export default OccurrenceItem;
