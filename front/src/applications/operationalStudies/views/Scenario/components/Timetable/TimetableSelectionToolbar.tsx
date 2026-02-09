import { Checkbox } from '@osrd-project/ui-core';
import { FileDirectorySymlink, Trash, Upload } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TimetableItemId } from 'reducers/osrdconf/types';

type TimetableSelectionToolbarProps = {
  selectedTimetableItemIds: TimetableItemId[];
  areAllItemsSelected: boolean;
  areInvalidItems: boolean;
  toggleAllTrainsSelection: () => void;
  handleExportTimetableItems: () => void;
  handleDeleteTimetableItems: () => void;
  handleMoveTimetableItems: () => void;
};

const TimetableSelectionToolbar = ({
  selectedTimetableItemIds,
  areAllItemsSelected,
  areInvalidItems,
  toggleAllTrainsSelection,
  handleExportTimetableItems,
  handleDeleteTimetableItems,
  handleMoveTimetableItems,
}: TimetableSelectionToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });

  return (
    <div
      className={cx('timetable-selection-toolbar', {
        'are-invalid-items': areInvalidItems,
      })}
    >
      <button
        className="select-button"
        data-testid={
          areAllItemsSelected ? 'scenarios-unselect-all-button' : 'scenarios-select-all-button'
        }
        title={areAllItemsSelected ? t('timetable.unselectAll') : t('timetable.selectAll')}
        type="button"
      >
        <Checkbox
          small
          isIndeterminate={!areAllItemsSelected && selectedTimetableItemIds.length > 0}
          checked={areAllItemsSelected}
          onChange={toggleAllTrainsSelection}
        />
      </button>
      {selectedTimetableItemIds.length > 0 && (
        <>
          <button
            data-testid="export-selection-button"
            className="export-selection-button"
            title={t('timetable.exportSelection')}
            onClick={handleExportTimetableItems}
            type="button"
          >
            <Upload />
          </button>
          <button
            className="delete-selection-button"
            data-testid="delete-all-items-button"
            title={t('timetable.deleteSelection')}
            onClick={handleDeleteTimetableItems}
            type="button"
          >
            <Trash />
          </button>
          <button
            className="delete-selection-button"
            data-testid="move-all-items-button"
            title={t('timetable.trainScheduleSets.moveToPackage')}
            onClick={handleMoveTimetableItems}
            type="button"
          >
            <FileDirectorySymlink />
          </button>
        </>
      )}
    </div>
  );
};

export default TimetableSelectionToolbar;
