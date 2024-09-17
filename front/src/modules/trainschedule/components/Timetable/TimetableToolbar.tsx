import { useContext, useState } from 'react';

import { Filter, Trash, Download } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BiSelectMultiple } from 'react-icons/bi';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type TrainScheduleResult } from 'common/api/osrdEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { setFailure, setSuccess } from 'reducers/main';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

import FilterPanel from './FilterPanel';
import type {
  ScheduledPointsHonoredFilter,
  TrainScheduleWithDetails,
  ValidityFilter,
} from './types';
import useFilterTrainSchedules from './useFilterTrainSchedules';

type TimetableToolbarProps = {
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  displayedTrainSchedules: TrainScheduleWithDetails[];
  setDisplayedTrainSchedules: (trainSchedulesDetails: TrainScheduleWithDetails[]) => void;
  selectedTrainIds: number[];
  setSelectedTrainIds: (selectedTrainIds: number[]) => void;
  multiSelectOn: boolean;
  setMultiSelectOn: (multiSelectOn: boolean) => void;
  removeTrains: (trainIds: number[]) => void;
  trainSchedules: TrainScheduleResult[];
};

const TimetableToolbar = ({
  trainSchedulesWithDetails,
  displayedTrainSchedules,
  setDisplayedTrainSchedules,
  selectedTrainIds,
  setSelectedTrainIds,
  multiSelectOn,
  setMultiSelectOn,
  removeTrains,
  trainSchedules,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);
  const dispatch = useAppDispatch();
  const { openModal } = useContext(ModalContext);

  const selectedTrainId = useSelector(getSelectedTrainId);

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const [filter, setFilter] = useState('');
  const [rollingStockFilter, setRollingStockFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('both');
  const [scheduledPointsHonoredFilter, setScheduledPointsHonoredFilter] =
    useState<ScheduledPointsHonoredFilter>('both');
  const [selectedTags, setSelectedTags] = useState<Set<string | null>>(new Set());

  const debouncedFilter = useDebounce(filter, 500);

  const debouncedRollingstockFilter = useDebounce(rollingStockFilter, 500);

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  // TODO: move this hook in Timetable
  const { uniqueTags } = useFilterTrainSchedules(
    trainSchedulesWithDetails,
    debouncedFilter,
    debouncedRollingstockFilter,
    validityFilter,
    scheduledPointsHonoredFilter,
    selectedTags,
    setDisplayedTrainSchedules
  );

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  const toggleAllTrainsSelecton = () => {
    if (displayedTrainSchedules.length === selectedTrainIds.length) {
      setSelectedTrainIds([]);
    } else {
      setSelectedTrainIds(displayedTrainSchedules.map((train) => train.id));
    }
  };

  const handleTrainsDelete = async () => {
    const trainsCount = selectedTrainIds.length;

    if (selectedTrainId && selectedTrainIds.includes(selectedTrainId)) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    await deleteTrainSchedules({ body: { ids: selectedTrainIds } })
      .unwrap()
      .then(() => {
        removeTrains(selectedTrainIds);
        dispatch(
          setSuccess({
            title: t('timetable.trainsSelectionDeletedCount', { count: trainsCount }),
            text: '',
          })
        );
      })
      .catch((e) => {
        if (selectedTrainId && selectedTrainIds.includes(selectedTrainId)) {
          dispatch(updateSelectedTrainId(selectedTrainId));
        } else {
          dispatch(setFailure(castErrorToFailure(e)));
        }
      });
  };

  const exportTrainSchedules = (selectedTrainIdsFromClick: number[]) => {
    if (!trainSchedules) return;

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

  return (
    <>
      <div className="scenario-timetable-toolbar justify-content-between">
        <div className="multi-select-buttons">
          {multiSelectOn && (
            <>
              <input
                type="checkbox"
                className="mr-2"
                checked={selectedTrainIds.length === trainSchedulesWithDetails.length}
                onChange={() => toggleAllTrainsSelecton()}
              />
              <button
                aria-label={t('timetable.deleteSelection')}
                disabled={!selectedTrainIds.length}
                className={cx('multiselect-delete', { disabled: !selectedTrainIds.length })}
                type="button"
                onClick={() =>
                  openModal(
                    <DeleteModal
                      handleDelete={handleTrainsDelete}
                      items={t('common/itemTypes:trains', { count: selectedTrainIds.length })}
                    />,
                    'sm'
                  )
                }
              >
                <Trash />
              </button>
              <button
                aria-label={t('timetable.downloadSelection')}
                disabled={!selectedTrainIds.length}
                className={cx('mx-2 multiselect-download', { disabled: !selectedTrainIds.length })}
                type="button"
                onClick={() => exportTrainSchedules(selectedTrainIds)}
              >
                <Download />
              </button>
            </>
          )}
        </div>
        <div data-testid="train-count">
          {trainSchedules.length > 0
            ? t(
                'trainCount',
                multiSelectOn
                  ? {
                      count: selectedTrainIds.length,
                      totalCount: displayedTrainSchedules.length,
                    }
                  : {
                      count: displayedTrainSchedules.length,
                      totalCount: trainSchedules.length,
                    }
              )
            : t('timetable.noTrain')}
        </div>
        <div className="d-flex">
          {!isEmpty(trainSchedulesWithDetails) && (
            <button
              aria-label={t('timetable.toggleMultiSelection')}
              type="button"
              className={cx('filter-selector', 'mr-1', { on: multiSelectOn })}
              onClick={() => setMultiSelectOn(!multiSelectOn)}
            >
              <BiSelectMultiple />
            </button>
          )}

          <button
            data-testid="timetable-filter-button"
            aria-label={t('timetable.toggleFilters')}
            onClick={toggleFilterPanel}
            type="button"
            className={cx('filter-selector', 'btn', 'btn-sm', 'btn-only-icon', {
              on: isFilterPanelOpen,
            })}
          >
            <Filter />
          </button>
        </div>
      </div>
      {isFilterPanelOpen && (
        <FilterPanel
          filter={filter}
          setFilter={setFilter}
          rollingStockFilter={rollingStockFilter}
          setRollingStockFilter={setRollingStockFilter}
          validityFilter={validityFilter}
          setValidityFilter={setValidityFilter}
          scheduledPointsHonoredFilter={scheduledPointsHonoredFilter}
          setScheduledPointsHonoredFilter={setScheduledPointsHonoredFilter}
          uniqueTags={uniqueTags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
        />
      )}
    </>
  );
};

export default TimetableToolbar;
