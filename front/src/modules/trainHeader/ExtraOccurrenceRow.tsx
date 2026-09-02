import { Trash } from '@osrd-project/ui-icons';

import { useDateTimeLocale, timeToLocaleString } from 'utils/date';
import type { StartTime } from 'utils/duration';

type ExtraOccurrenceRowProps = {
  startTime: StartTime;
  onDelete: () => void;
};

const ExtraOccurrenceRow = ({ startTime, onDelete }: ExtraOccurrenceRowProps) => {
  const dateTimeLocale = useDateTimeLocale();

  return (
    <div className="train-extra-occurrence" data-testid="train-header-extra-occurrence-row">
      <button
        className="train-extra-occurrence-delete"
        onClick={onDelete}
        data-testid="train-header-extra-occurrence-delete-button"
      >
        <Trash />
      </button>
      {startTime instanceof Date && (
        <div
          className="train-extra-occurrence-date"
          data-testid="train-header-extra-occurrence-date-value"
        >
          {startTime.toLocaleDateString(dateTimeLocale)}
        </div>
      )}
      <div
        className="train-extra-occurrence-time"
        data-testid="train-header-extra-occurrence-time-value"
      >
        {timeToLocaleString(startTime, dateTimeLocale)}
      </div>
    </div>
  );
};

export default ExtraOccurrenceRow;
