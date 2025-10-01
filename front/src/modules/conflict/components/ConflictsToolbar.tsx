import { Checkbox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

type ConflictsToolbarProps = {
  isFilterActive: boolean;
  onToggleFilter: () => void;
  selectedTrainName: string | null;
  conflictsCount: number;
  disabled?: boolean;
};

const ConflictsToolbar = ({
  isFilterActive,
  onToggleFilter,
  selectedTrainName,
  conflictsCount,
  disabled = false,
}: ConflictsToolbarProps) => {
  const { t } = useTranslation('operational-studies');

  const getDisplayText = () => {
    if (!selectedTrainName) {
      return <span className="filter-text">{t('main.conflicts.filterWithSelectedTrain')}</span>;
    }

    const conflictsText = t('main.conflicts.conflictsCount', { count: conflictsCount });

    return (
      <>
        <span className="filter-text">{t('main.conflicts.for')} </span>
        <span className="train-name">{selectedTrainName}</span>
        <span className="filter-text"> ({conflictsText})</span>
      </>
    );
  };

  return (
    <div className="conflicts-toolbar">
      <div className="filter">
        <Checkbox
          data-testid="conflicts-filter-checkbox"
          checked={isFilterActive}
          onChange={onToggleFilter}
          disabled={disabled || !selectedTrainName}
          small
        />
        <div className="filter-label">{getDisplayText()}</div>
      </div>
    </div>
  );
};

export default ConflictsToolbar;
