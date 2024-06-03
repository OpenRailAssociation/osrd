import React, { useContext, useState } from 'react';

import { Filter, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BiSelectMultiple } from 'react-icons/bi';
import { useSelector } from 'react-redux';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { setFailure, setSuccess } from 'reducers/main';
import { updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

import FilterPanel from './FilterPanel';
import useTrainSchedulesDetails from './hooks';
import type { TrainScheduleWithDetails, ValidityFilter } from './types';

type TimetableToolbarProps = {
  trainIds: number[];
  trainSchedulesDetails: TrainScheduleWithDetails[];
  setTrainSchedulesDetails: (trainSchedulesDetails: TrainScheduleWithDetails[]) => void;
  selectedTrainIds: number[];
  setSelectedTrainIds: (selectedTrainIds: number[]) => void;
  multiSelectOn: boolean;
  setMultiSelectOn: (multiSelectOn: boolean) => void;
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
  setSpaceTimeData: React.Dispatch<React.SetStateAction<TrainSpaceTimeData[]>>;
};

const TimetableToolbar = ({
  trainIds,
  trainSchedulesDetails,
  setTrainSchedulesDetails,
  selectedTrainIds,
  setSelectedTrainIds,
  multiSelectOn,
  setMultiSelectOn,
  setTrainResultsToFetch,
  setSpaceTimeData,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);
  const dispatch = useAppDispatch();
  const { openModal } = useContext(ModalContext);

  const selectedTrainId = useSelector(getSelectedTrainId);

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const [filter, setFilter] = useState('');
  const [rollingStockFilter, setRollingStockFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('both');
  const [selectedTags, setSelectedTags] = useState<Set<string | null>>(new Set());

  const debouncedFilter = useDebounce(filter, 500);
  const debouncedRollingstockFilter = useDebounce(rollingStockFilter, 500);

  const [deleteTrainSchedules] = enhancedEditoastApi.endpoints.deleteV2TrainSchedule.useMutation();

  const uniqueTags = useTrainSchedulesDetails(
    trainIds,
    setTrainSchedulesDetails,
    debouncedFilter,
    debouncedRollingstockFilter,
    validityFilter,
    selectedTags
  );

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  const toggleAllTrainsSelecton = () => {
    if (trainSchedulesDetails.length === selectedTrainIds.length) {
      setSelectedTrainIds([]);
    } else {
      setSelectedTrainIds(trainSchedulesDetails.map((train) => train.id));
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
        setTrainResultsToFetch([]); // We don't want to fetch space time data again
        setSpaceTimeData((prev) => prev.filter((train) => !selectedTrainIds.includes(train.id)));
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

  return (
    <>
      <div className="scenario-timetable-toolbar justify-content-between">
        <div className="multi-select-buttons">
          {multiSelectOn && (
            <>
              <input
                type="checkbox"
                className="mr-2"
                checked={selectedTrainIds.length === trainSchedulesDetails.length}
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
            </>
          )}
        </div>
        <div>
          {multiSelectOn && <span>{selectedTrainIds.length} / </span>}
          {t('trainCount', {
            count: trainSchedulesDetails.length,
          })}
        </div>
        <div className="d-flex">
          {!isEmpty(trainSchedulesDetails) && (
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
          uniqueTags={uniqueTags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
        />
      )}
    </>
  );
};

export default TimetableToolbar;
