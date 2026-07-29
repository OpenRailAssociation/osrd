import { Trash } from '@osrd-project/ui-icons';

type ExtraOccurrenceRowProps = {
  startTime: Date;
  onDelete: () => void;
};

function formatDateString(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatTimeString(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const ExtraOccurrenceRow = ({ startTime, onDelete }: ExtraOccurrenceRowProps) => (
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
      {formatDateString(startTime)}
    </div>
    <div
      className="train-extra-occurrence-time"
      data-testid="train-header-extra-occurrence-time-value"
    >
      {formatTimeString(startTime)}
    </div>
  </div>
);

export default ExtraOccurrenceRow;
