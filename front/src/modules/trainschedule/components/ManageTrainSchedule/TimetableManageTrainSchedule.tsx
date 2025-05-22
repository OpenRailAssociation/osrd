import { useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import DotsLoader from 'common/DotsLoader';
import { toggleEditingItemType } from 'reducers/osrdconf/operationalStudiesConf';
import { getEditingItemType } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { isPacedTrainId, isTrainScheduleId } from 'utils/trainId';

import AddTrainScheduleButton from './AddTrainScheduleButton';
import useUpdateTimetableItem from './hooks/useUpdateTimetableItem';
import PacedTrainSettings from './PacedTrainSettings';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  itemIdToEdit?: TimetableItemId;
  setDisplayTrainScheduleManagement: (type: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void;
  infraState?: InfraState;
  setItemIdToEdit: (itemIdToEdit?: TimetableItemId) => void;
};

const TimetableManageTrainSchedule = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  removeTimetableItems,
  infraState,
  itemIdToEdit,
  setItemIdToEdit,
}: TimetableManageTrainScheduleProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const editingItemType = useSelector(getEditingItemType);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [isWorking, setIsWorking] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setItemIdToEdit(undefined);
  };

  const updateTimetable = useUpdateTimetableItem(
    setIsWorking,
    setDisplayTrainScheduleManagement,
    upsertTimetableItems,
    removeTimetableItems,
    setItemIdToEdit,
    itemIdToEdit,
    selectedTrainId
  );

  const getEditLabel = (_itemIdToEdit: TimetableItemId) => {
    if (isTrainScheduleId(_itemIdToEdit) && editingItemType === 'trainSchedule') {
      return t('updateTrainSchedule');
    }
    if (isPacedTrainId(_itemIdToEdit) && editingItemType === 'pacedTrain') {
      return t('updatePacedTrain');
    }
    return isTrainScheduleId(_itemIdToEdit)
      ? t('turnTrainScheduleIntoPacedTrain')
      : t('turnPacedTrainIntoTrainSchedule');
  };

  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit && itemIdToEdit && (
          <>
            <button
              className="btn btn-warning mb-2"
              type="button"
              onClick={updateTimetable}
              data-testid="submit-edit-train-schedule"
            >
              <span className="mr-2">
                <Pencil size="lg" />
              </span>
              {getEditLabel(itemIdToEdit)}
            </button>
            <div className="osrd-config-item-container">
              <CheckboxRadioSNCF
                type="checkbox"
                label={t('pacedTrains.defineService')}
                id="define-paced-train"
                name="define-paced-train"
                containerClassName="mb-0"
                checked={editingItemType === 'pacedTrain'}
                onChange={() => dispatch(toggleEditingItemType())}
              />
              {editingItemType === 'pacedTrain' && <PacedTrainSettings />}
            </div>
          </>
        )}

        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add && (
          <>
            {isWorking ? (
              <button
                className="btn btn-primary disabled mb-2"
                type="button"
                aria-label={t('saving')}
                title={t('saving')}
              >
                <DotsLoader />
              </button>
            ) : (
              <AddTrainScheduleButton
                infraState={infraState}
                setIsWorking={setIsWorking}
                upsertTimetableItems={upsertTimetableItems}
                isPacedTrainMode={editingItemType === 'pacedTrain'}
              />
            )}
            <div className="osrd-config-item-container">
              <CheckboxRadioSNCF
                type="checkbox"
                label={t('pacedTrains.defineService')}
                id="define-paced-train"
                name="define-paced-train"
                containerClassName="mb-0"
                checked={editingItemType === 'pacedTrain'}
                onChange={() => dispatch(toggleEditingItemType())}
              />
              {editingItemType === 'pacedTrain' && <PacedTrainSettings />}
            </div>
          </>
        )}
      </div>
      <div
        className="scenario-timetable-managetrainschedule-body"
        role="button"
        tabIndex={0}
        onClick={leaveManageTrainSchedule}
      >
        <button
          className="btn btn-secondary btn-block"
          data-testid="return-simulation-result"
          type="button"
        >
          <span className="mr-2">
            <ChevronLeft size="lg" />
          </span>
          {t('returnToSimulationResults')}
        </button>
      </div>
    </div>
  );
};

export default TimetableManageTrainSchedule;
