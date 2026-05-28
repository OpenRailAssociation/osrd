import { Plus } from '@osrd-project/ui-icons';

type CellPlaceholderProps = {
  onClick: () => void;
};

const CellPlaceholder = ({ onClick }: CellPlaceholderProps) => (
  <div
    className="input-cell-placeholder"
    data-testid="input-cell-placeholder"
    onClick={onClick}
    role="button"
    tabIndex={-1}
  >
    <Plus />
  </div>
);

export default CellPlaceholder;
