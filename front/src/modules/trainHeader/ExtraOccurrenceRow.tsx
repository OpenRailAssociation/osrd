import { Trash } from '@osrd-project/ui-icons';

import { useDateTimeLocale } from 'utils/date';

type ExtraOccurrenceRowProps = {
  startTime: Date;
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
      <div
        className="train-extra-occurrence-date"
        data-testid="train-header-extra-occurrence-date-value"
      >
        {startTime.toLocaleDateString(dateTimeLocale)}
      </div>
      <div
        className="train-extra-occurrence-time"
        data-testid="train-header-extra-occurrence-time-value"
      >
        {startTime.toLocaleTimeString(dateTimeLocale)}
      </div>
    </div>
  );
};

export default ExtraOccurrenceRow;
