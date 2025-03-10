import { useContext, useMemo, useState } from 'react';

import { Button, Checkbox } from '@osrd-project/ui-core';
import { Alert, Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainId,
  TimetableItemId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { formatTrainScheduleIdToEditoastTrainId, isTrainSchedule } from 'utils/trainId';

import FilterPanel from './FilterPanel';
import type { TimetableFilters, TimetableItemResult } from './types';
import { timetableHasInvalidItem } from './utils';

type TimetableToolbarProps = {
  showTrainDetails: boolean;
  toggleShowTrainDetails: () => void;
  timetableItems: TimetableItemResult[];
  filteredTimetableItems: TimetableItemResult[];
  timetableFilters: TimetableFilters;
  selectedTimetableItemIds: TimetableItemId[];
  setSelectedTimetableItemIds: (selectedTimetableIds: TimetableItemId[]) => void;
  removeTrains: (trainIds: TimetableItemId[]) => void;
  trainSchedules: TrainScheduleResultWithTrainId[];
  isInSelection: boolean;
};

const TimetableToolbar = ({
  showTrainDetails,
  toggleShowTrainDetails,
  timetableItems,
  filteredTimetableItems,
  timetableFilters,
  selectedTimetableItemIds,
  setSelectedTimetableItemIds,
  removeTrains,
  trainSchedules,
  isInSelection,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes', 'translation']);
  const dispatch = useAppDispatch();
  const { openModal } = useContext(ModalContext);

  const selectedTrainId = useSelector(getSelectedTrainId);

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const { selectedTrainScheduleIds, selectedPacedTrainIds } = useMemo(
    () =>
      selectedTimetableItemIds.reduce(
        (acc, timetableItemId) => {
          if (isTrainSchedule(timetableItemId)) {
            acc.selectedTrainScheduleIds.push(timetableItemId);
          } else {
            acc.selectedPacedTrainIds.push(timetableItemId);
          }
          return acc;
        },
        { selectedTrainScheduleIds: [], selectedPacedTrainIds: [] } as {
          selectedTrainScheduleIds: TrainScheduleId[];
          selectedPacedTrainIds: PacedTrainId[];
        }
      ),
    [selectedTimetableItemIds]
  );

  const { totalPacedTrainCount, totalTrainScheduleCount } = useMemo(
    () =>
      timetableItems.reduce(
        (acc, { id }) => {
          if (isTrainSchedule(id)) {
            acc.totalTrainScheduleCount += 1;
          } else {
            acc.totalPacedTrainCount += 1;
          }
          return acc;
        },
        { totalPacedTrainCount: 0, totalTrainScheduleCount: 0 }
      ),
    [timetableItems]
  );

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  const toggleAllTrainsSelecton = () => {
    if (filteredTimetableItems.length === selectedTimetableItemIds.length) {
      setSelectedTimetableItemIds([]);
    } else {
      const timetableItemsDisplayed = filteredTimetableItems.map(({ id }) => id);
      setSelectedTimetableItemIds(timetableItemsDisplayed);
    }
  };

  const handleTrainsDelete = async () => {
    const itemsCount = selectedTimetableItemIds.length;

    // TODO Paced train : Adapt this to handle delete paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    if (selectedTrainId && selectedTimetableItemIds.includes(selectedTrainId as TrainScheduleId)) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    // TODO Paced train : Adapt this to handle delete paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    const editoastSelectedTrainScheduleIds = selectedTrainScheduleIds.map((id) =>
      formatTrainScheduleIdToEditoastTrainId(id)
    );

    await deleteTrainSchedules({ body: { ids: editoastSelectedTrainScheduleIds } })
      .unwrap()
      .then(() => {
        removeTrains(selectedTrainScheduleIds);
        dispatch(
          setSuccess({
            title: t('timetable.trainsSelectionDeletedCount', { count: itemsCount }),
            text: '',
          })
        );
      })
      .catch((e) => {
        // TODO Paced train : Adapt this to handle delete paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
        if (
          selectedTrainId &&
          selectedTimetableItemIds.includes(selectedTrainId as TrainScheduleId)
        ) {
          dispatch(updateSelectedTrainId(selectedTrainId));
        } else {
          dispatch(setFailure(castErrorToFailure(e)));
        }
      });
  };

  const exportTrainSchedules = (selectedTrainIdsFromClick: TimetableItemId[]) => {
    if (!trainSchedules) return;

    // TODO Paced train : Adapt this to handle export paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10614
    const formattedTrainSchedules = trainSchedules
      .filter(({ id }) => selectedTrainIdsFromClick.includes(id))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ id, timetable_id, ...trainSchedule }) => trainSchedule);

    const jsonString = JSON.stringify(formattedTrainSchedules);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'train_schedules.json';
    a.click();
  };

  const computedItemLabel = (trainSchedulesCount: number, pacedTrainCount: number) => {
    if (trainSchedulesCount === 0 && pacedTrainCount === 0) return t('timetable.noItem');

    const pacedTrainLabel = t('pacedTrainCount', {
      count: selectedPacedTrainIds.length,
      totalCount: totalPacedTrainCount,
    });

    const trainScheduleLabel = t('trainCount', {
      count: selectedTrainScheduleIds.length,
      totalCount: totalTrainScheduleCount,
    });

    if (
      trainSchedulesCount === 0 ||
      (selectedPacedTrainIds.length > 0 && selectedTrainScheduleIds.length === 0)
    ) {
      return pacedTrainLabel;
    }

    if (
      pacedTrainCount === 0 ||
      (selectedTrainScheduleIds.length > 0 && selectedPacedTrainIds.length === 0)
    ) {
      return trainScheduleLabel;
    }

    if (selectedTrainScheduleIds.length > 0 && selectedPacedTrainIds.length > 0) {
      return t('pacedTrainAndTrainCount', {
        pacedTrainCount: selectedPacedTrainIds.length,
        totalPacedTrainCount,
        trainCount: selectedTrainScheduleIds.length,
        totalTrainScheduleCount,
      });
    }

    return `${pacedTrainLabel}\u00A0${t('translation:common.and')}\u00A0${trainScheduleLabel}`;
  };

  return (
    <>
      <div
        className={cx('scenario-timetable-toolbar', {
          centered: trainSchedules.length === 0,
        })}
      >
        <div
          className={cx('toolbar-header', {
            'with-details': isInSelection,
          })}
        >
          {trainSchedules.length === 0 ? (
            <div className="train-count">
              <Checkbox small readOnly label={t('timetable.noTrain')} />
            </div>
          ) : (
            <div className="train-count">
              <Checkbox
                label={computedItemLabel(totalTrainScheduleCount, totalPacedTrainCount)}
                small
                checked={
                  selectedTimetableItemIds.length === timetableItems.length &&
                  selectedTimetableItemIds.length > 0
                }
                isIndeterminate={
                  selectedTimetableItemIds.length !== timetableItems.length &&
                  selectedTimetableItemIds.length > 0
                }
                onChange={() => toggleAllTrainsSelecton()}
              />
            </div>
          )}

          {trainSchedules.length > 0 && (
            <div>
              <button
                type="button"
                className="more-details-button"
                onClick={toggleShowTrainDetails}
                title={t('displayTrainsWithDetails')}
              >
                {showTrainDetails ? t('lessDetails') : t('moreDetails')}
              </button>
            </div>
          )}
        </div>

        {selectedTimetableItemIds.length > 0 && (
          <div className="action-buttons">
            <Button
              size="small"
              variant="Destructive"
              label={t('timetable.delete')}
              title={t('timetable.deleteSelection')}
              onClick={() =>
                openModal(
                  <DeleteModal
                    handleDelete={handleTrainsDelete}
                    items={t('common/itemTypes:trains', { count: selectedTimetableItemIds.length })}
                  />,
                  'sm'
                )
              }
            />
            <Button
              size="small"
              label={t('timetable.export')}
              title={t('timetable.exportSelection')}
              type="button"
              // TODO PACED TRAIN: https://github.com/OpenRailAssociation/osrd/issues/10614
              onClick={() => exportTrainSchedules(selectedTrainScheduleIds)}
            />
          </div>
        )}
      </div>
      {timetableHasInvalidItem(filteredTimetableItems) && (
        <div className="invalid-trains">
          <Alert size="sm" variant="fill" />
          <span data-testid="invalid-trains-message" className="invalid-trains-message">
            {t('timetable.invalidTrains')}
          </span>
        </div>
      )}
      {trainSchedules.length > 0 && (
        <div
          className={cx('sticky-filter', {
            'selection-mode-open': isInSelection,
          })}
        >
          {!isFilterPanelOpen ? (
            <div className="filter">
              <button
                data-testid="timetable-filter-button"
                aria-label={t('timetable.toggleFilters')}
                onClick={toggleFilterPanel}
                type="button"
                className="filter-button"
              >
                <Filter />
              </button>
            </div>
          ) : (
            <FilterPanel
              toggleFilterPanel={toggleFilterPanel}
              timetableFilters={timetableFilters}
            />
          )}
        </div>
      )}
    </>
  );
};

export default TimetableToolbar;
