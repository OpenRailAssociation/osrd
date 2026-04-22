import { Checkbox } from '@osrd-project/ui-core';
import { FileDirectorySymlink, Trash, Upload } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

type TimetableSelectionToolbarProps = {
  selectedTrainScheduleIds: number[];
  areAllTrainchedulesSelected: boolean;
  areInvalidTrainSchedules: boolean;
  toggleAllTrainsSelection: () => void;
  handleExportTrainSchedules: () => void;
  handleDeleteTrainSchedules: () => void;
  handleMoveTrainSchedules: () => void;
};

const TimetableSelectionToolbar = ({
  selectedTrainScheduleIds,
  areAllTrainchedulesSelected,
  areInvalidTrainSchedules,
  toggleAllTrainsSelection,
  handleExportTrainSchedules,
  handleDeleteTrainSchedules,
  handleMoveTrainSchedules,
}: TimetableSelectionToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });

  return (
    <div
      className={cx('timetable-selection-toolbar', {
        'are-invalid-items': areInvalidTrainSchedules,
      })}
    >
      <button
        className="select-button"
        data-testid={
          areAllTrainchedulesSelected
            ? 'scenarios-unselect-all-button'
            : 'scenarios-select-all-button'
        }
        title={areAllTrainchedulesSelected ? t('timetable.unselectAll') : t('timetable.selectAll')}
        type="button"
      >
        <Checkbox
          small
          isIndeterminate={!areAllTrainchedulesSelected && selectedTrainScheduleIds.length > 0}
          checked={areAllTrainchedulesSelected}
          onChange={toggleAllTrainsSelection}
        />
      </button>
      {selectedTrainScheduleIds.length > 0 && (
        <>
          <button
            data-testid="export-selection-button"
            className="export-selection-button"
            title={t('timetable.exportSelection')}
            onClick={handleExportTrainSchedules}
            type="button"
          >
            <Upload />
          </button>
          <button
            className="delete-selection-button"
            data-testid="delete-all-trains-button"
            title={t('timetable.deleteSelection')}
            onClick={handleDeleteTrainSchedules}
            type="button"
          >
            <Trash />
          </button>
          <button
            className="delete-selection-button"
            data-testid="move-all-items-button"
            title={t('timetable.trainScheduleSets.moveToPackage')}
            onClick={handleMoveTrainSchedules}
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
