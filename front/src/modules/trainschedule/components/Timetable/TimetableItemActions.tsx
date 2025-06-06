// import React from 'react';

import { Duplicate, Pencil, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { GiPathDistance } from 'react-icons/gi';

type TimetableItemActionsProps = {
  selectPathProjection: () => Promise<void>;
  duplicateTimetableItem: () => Promise<void>;
  editTimetableItem: () => void;
  deleteTimetableItem: () => Promise<void>;
  isTimetableItemValid?: boolean;
};

const TimetableItemActions = ({
  selectPathProjection,
  duplicateTimetableItem,
  editTimetableItem,
  deleteTimetableItem,
  isTimetableItemValid = true,
}: TimetableItemActionsProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  return (
    <div className="action-buttons">
      <button
        type="button"
        aria-label={t('timetable.choosePath')}
        title={t('timetable.choosePath')}
        onClick={selectPathProjection}
        data-testid="project-item"
        disabled={!isTimetableItemValid}
      >
        <GiPathDistance />
      </button>
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
        data-testid="delete-item"
      >
        <Trash />
      </button>
    </div>
  );
};

export default TimetableItemActions;
