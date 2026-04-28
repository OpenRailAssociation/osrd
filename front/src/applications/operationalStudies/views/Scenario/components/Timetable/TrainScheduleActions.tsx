import { Duplicate, FileDirectorySymlink, Iterations, Pencil, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { GiPathDistance } from 'react-icons/gi';

type TrainScheduleActionsProps = {
  selectPathProjection: () => Promise<void>;
  moveTrainSchedule: () => void;
  duplicateTrainSchedule: () => Promise<void>;
  editTrainSchedule: () => void;
  deleteTrainSchedule: () => Promise<void>;
  showResetExceptionsButton?: boolean;
  resetAllExceptions?: () => void;
  showMovebutton: boolean;
};

const TrainScheduleActions = ({
  selectPathProjection,
  moveTrainSchedule,
  duplicateTrainSchedule,
  editTrainSchedule,
  deleteTrainSchedule,
  showResetExceptionsButton,
  resetAllExceptions,
  showMovebutton,
}: TrainScheduleActionsProps) => {
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
        data-testid="project-train"
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
        onClick={duplicateTrainSchedule}
        data-testid="duplicate-train"
      >
        <Duplicate />
      </button>
      <button
        type="button"
        aria-label={t('timetable.update')}
        title={t('timetable.update')}
        onClick={editTrainSchedule}
        data-testid="edit-train"
      >
        <Pencil />
      </button>
      <button
        type="button"
        aria-label={t('timetable.delete')}
        title={t('timetable.delete')}
        onClick={deleteTrainSchedule}
        data-testid="delete-train"
      >
        <Trash />
      </button>
    </div>
  );
};

export default TrainScheduleActions;
