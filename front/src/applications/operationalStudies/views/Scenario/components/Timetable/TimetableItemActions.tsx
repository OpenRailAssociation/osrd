import { Duplicate, FileDirectorySymlink, Iterations, Pencil, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { GiPathDistance } from 'react-icons/gi';

type TimetableItemActionsProps = {
  selectPathProjection: () => Promise<void>;
  moveTrainSchedule: () => void;
  duplicateTimetableItem: () => Promise<void>;
  editTimetableItem: () => void;
  deleteTimetableItem: () => Promise<void>;
  showResetExceptionsButton?: boolean;
  resetAllExceptions?: () => void;
  showMovebutton: boolean;
};

const TimetableItemActions = ({
  selectPathProjection,
  moveTrainSchedule,
  duplicateTimetableItem,
  editTimetableItem,
  deleteTimetableItem,
  showResetExceptionsButton,
  resetAllExceptions,
  showMovebutton,
}: TimetableItemActionsProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  return (
    <div className="action-buttons">
      {showResetExceptionsButton && (
        <button
          className="reset-exceptions"
          type="button"
          aria-label={t('timetable.resetExceptions')}
          title={t('timetable.resetExceptions')}
          onClick={resetAllExceptions}
          data-testid="reset-exceptions"
        >
          <Iterations />
        </button>
      )}
      <button
        type="button"
        aria-label={t('timetable.choosePath')}
        title={t('timetable.choosePath')}
        onClick={selectPathProjection}
        data-testid="project-item"
      >
        <GiPathDistance />
      </button>
      {showMovebutton && (
        <button
          type="button"
          aria-label={t('timetable.trainScheduleSets.moveToPackage')}
          title={t('timetable.trainScheduleSets.moveToPackage')}
          onClick={moveTrainSchedule}
          data-testid="move-train"
        >
          <FileDirectorySymlink />
        </button>
      )}
      <button
        type="button"
        aria-label={t('timetable.duplicate')}
        title={t('timetable.duplicate')}
        onClick={duplicateTimetableItem}
        data-testid="duplicate-item"
      >
        <Duplicate />
      </button>
      <button
        type="button"
        aria-label={t('timetable.update')}
        title={t('timetable.update')}
        onClick={editTimetableItem}
        data-testid="edit-item"
      >
        <Pencil />
      </button>
      <button
        type="button"
        aria-label={t('timetable.delete')}
        title={t('timetable.delete')}
        onClick={deleteTimetableItem}
        data-testid="delete-train"
      >
        <Trash />
      </button>
    </div>
  );
};

export default TimetableItemActions;
