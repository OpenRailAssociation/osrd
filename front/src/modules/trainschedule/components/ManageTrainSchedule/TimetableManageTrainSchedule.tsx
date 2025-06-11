import { useContext, useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { EditedElementContainerContext } from 'applications/operationalStudies/components/Scenario/EditedElementContainerContext';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import DotsLoader from 'common/DotsLoader';
import { toggleEditingItemType } from 'reducers/osrdconf/operationalStudiesConf';
import { getEditingItemType } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { isPacedTrainId, isTrainScheduleId } from 'utils/trainId';

import CreateTimetableItemButton from './CreateTimetableItemButton';
import useUpdateTimetableItem from './hooks/useUpdateTimetableItem';
import PacedTrainSettings from './PacedTrainSettings';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  timetableItemToEditData?: TimetableItemToEditData;
  setDisplayTrainScheduleManagement: (type: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void;
  infraState?: InfraState;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
};

/**
 * Create/edit train schedules and paced trains
 */
const TimetableManageTrainSchedule = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  removeTimetableItems,
  infraState,
  timetableItemToEditData,
  setTimetableItemToEditData,
}: TimetableManageTrainScheduleProps) => {
  const { setEditedElementContainer } = useContext(EditedElementContainerContext);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const editingItemType = useSelector(getEditingItemType);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [isWorking, setIsWorking] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTimetableItemToEditData(undefined);
  };

  const updateTimetable = useUpdateTimetableItem(
    setIsWorking,
    setDisplayTrainScheduleManagement,
    upsertTimetableItems,
    removeTimetableItems,
    setTimetableItemToEditData,
    timetableItemToEditData,
    selectedTrainId
  );

  const getEditLabel = (_itemIdToEdit: TimetableItemId) => {
    if (isTrainScheduleId(_itemIdToEdit) && editingItemType === 'trainSchedule') {
      return t('updateTrainSchedule');
    }
    if (isPacedTrainId(_itemIdToEdit) && editingItemType !== 'trainSchedule') {
      return editingItemType === 'pacedTrain' ? t('updatePacedTrain') : t('updateOccurrence');
    }
    return isTrainScheduleId(_itemIdToEdit)
      ? t('turnTrainScheduleIntoPacedTrain')
      : t('turnPacedTrainIntoTrainSchedule');
  };

  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit &&
          timetableItemToEditData && (
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
                {getEditLabel(timetableItemToEditData.timetableItemId)}
              </button>
              {editingItemType !== 'occurrence' && (
                <div className="osrd-config-item-container paced-trains-container">
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
              )}
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
              <CreateTimetableItemButton
                infraState={infraState}
                setIsWorking={setIsWorking}
                upsertTimetableItems={upsertTimetableItems}
                isPacedTrainMode={editingItemType === 'pacedTrain'}
              />
            )}
            <div className="osrd-config-item-container paced-trains-container">
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
      <div ref={setEditedElementContainer} id="timetable-edited-element" />
    </div>
  );
};

export default TimetableManageTrainSchedule;
