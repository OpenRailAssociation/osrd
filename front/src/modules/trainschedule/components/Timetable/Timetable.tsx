import React, { useContext, useEffect, useMemo, useState } from 'react';

import { Alert, Download, Filter, Plus, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEmpty, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BiSelectMultiple } from 'react-icons/bi';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  Conflict,
  Infra,
  SimulationReport,
  TimetableWithSchedulesDetails,
} from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import findTrainsDurationsIntervals from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainsDurationsIntervals';
import TimetableTrainCard from 'modules/trainschedule/components/Timetable/TimetableTrainCard';
import { setFailure, setSuccess } from 'reducers/main';
import { updateSelectedTrainId, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getSelectedProjection } from 'reducers/osrdsimulation/selectors';
import type { ScheduledTrain, SimulationSnapshot } from 'reducers/osrdsimulation/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';
import { valueToInterval } from 'utils/numbers';
import { durationInSeconds } from 'utils/timeManipulation';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  trainsWithDetails: boolean;
  infraState: Infra['state'];
  timetable: TimetableWithSchedulesDetails | undefined;
  selectedTrainId?: number;
  refetchTimetable: () => void;
  conflicts?: Conflict[];
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
  simulation: SimulationSnapshot;
};

export default function Timetable({
  setDisplayTrainScheduleManagement,
  trainsWithDetails,
  infraState,
  timetable,
  selectedTrainId,
  refetchTimetable,
  conflicts,
  setTrainResultsToFetch,
  simulation,
}: TimetableProps) {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const { getTrainScheduleIDsToModify } = useOsrdConfSelectors();
  const { updateTrainScheduleIDsToModify } = useOsrdConfActions();
  const selectedProjection = useSelector(getSelectedProjection);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);

  const [filter, setFilter] = useState('');
  const [multiselectOn, setMultiselectOn] = useState(false);
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);
  const [rollingStockFilter, setRollingStockFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState('both');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState(new Set());

  const { openModal } = useContext(ModalContext);

  const dispatch = useAppDispatch();

  const debouncedFilter = useDebounce(filter, 500);
  const debouncedRollingstockFilter = useDebounce(rollingStockFilter, 500);

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  useEffect(() => {
    setMultiselectOn(false);
  }, [timetable, infraState]);

  const trainsDurationsIntervals = useMemo(
    () =>
      timetable?.train_schedule_summaries
        ? findTrainsDurationsIntervals(timetable.train_schedule_summaries)
        : [],
    [timetable]
  );

  // We fetch all RS to get the data we need for the advanced filters
  const { data: { results: rollingStocks } = { results: [] } } =
    enhancedEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  // Filter RS by their names and labels
  const keepTrain = (train: ScheduledTrain, searchString: string): boolean => {
    if (searchString) {
      const searchStringInName = train.train_name
        .toLowerCase()
        .includes(searchString.toLowerCase());
      const searchStringInTags = train.labels
        .join('')
        .toLowerCase()
        .includes(searchString.toLowerCase());
      return searchStringInName || searchStringInTags;
    }
    return true;
  };

  const specialCodeDictionary: { [key: string]: string } = {
    'Divers - Haut le pied': 'HLP',
    '': 'NO CODE',
  };

  const extractTagCode = (tag: string | null) => {
    if (!tag) {
      return 'NO CODE';
    }
    if (tag in specialCodeDictionary) {
      return specialCodeDictionary[tag];
    }

    const matches = tag.match(/\w+$/);
    return matches ? matches[0] : tag;
  };

  const trainsList = useMemo(() => {
    if (!timetable) return [];

    return timetable.train_schedule_summaries
      .filter((train) => {
        if (!keepTrain(train, debouncedFilter)) return false;

        // Apply validity filter
        if (validityFilter === 'valid' && train.invalid_reasons?.length > 0) return false;
        if (
          validityFilter === 'invalid' &&
          (!train.invalid_reasons || train.invalid_reasons.length === 0)
        )
          return false;

        // Apply tag filter
        if (selectedTags.size > 0 && !selectedTags.has(extractTagCode(train.speed_limit_tags)))
          return false;

        // Apply rolling stock filter
        const rollingStock = rollingStocks.find((rs) => rs.id === train.rolling_stock_id);
        const {
          detail = '',
          family = '',
          reference = '',
          series = '',
          subseries = '',
        } = rollingStock?.metadata || {};
        if (
          ![detail, family, reference, series, subseries].some((v) =>
            v.toLowerCase().includes(debouncedRollingstockFilter.toLowerCase())
          )
        )
          return false;

        return true;
      })
      .map((train) => {
        const rollingStock = rollingStocks.find((rs) => rs.id === train.rolling_stock_id);
        return {
          ...train,
          rollingStockMetadata: rollingStock?.metadata,
          rollingStockName: rollingStock?.name,
          duration: durationInSeconds(train.departure_time, train.arrival_time),
        };
      });
  }, [
    timetable,
    rollingStocks,
    debouncedFilter,
    validityFilter,
    selectedTags,
    debouncedRollingstockFilter,
  ]);

  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

  const timetableHasInvalidTrain = (trains: ScheduledTrain[]) =>
    trains.some((train) => train.invalid_reasons && train.invalid_reasons.length > 0);

  const toggleTrainSelection = (id: number) => {
    const currentSelectedTrainIds = [...selectedTrainIds];
    const index = currentSelectedTrainIds.indexOf(id);

    if (index === -1) {
      currentSelectedTrainIds.push(id);
    } else {
      currentSelectedTrainIds.splice(index, 1);
    }

    setSelectedTrainIds(currentSelectedTrainIds);
  };

  const validityOptions = [
    { value: 'both', label: t('timetable.showAllTrains') },
    { value: 'valid', label: t('timetable.showValidTrains') },
    { value: 'invalid', label: t('timetable.showInvalidTrains') },
  ];

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  const handleValidityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValidityFilter(event.target.value);
  };

  const selectAllTrains = () => {
    if (trainsList.length === selectedTrainIds.length) {
      setSelectedTrainIds([]);
    } else {
      const trainIds = trainsList.map((train) => train.id);
      setSelectedTrainIds(trainIds);
    }
  };

  const handleConflictClick = (conflict: Conflict) => {
    if (conflict.train_ids.length > 0) {
      const firstTrainId = conflict.train_ids[0];
      dispatch(updateSelectedTrainId(firstTrainId));
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
        const remainingTrains = (simulation.trains as SimulationReport[]).filter(
          (simulationTrain) => !selectedTrainIds.includes(simulationTrain.id)
        );
        if (remainingTrains.length > 0) {
          const remainingUniquesPathIds = uniq(remainingTrains.map((train) => train.path));
          // If there isn't any train left with the same path as the projected one and one of
          // the deleted trains is the projected one, we want to refetch all trains
          if (
            selectedProjection &&
            !remainingUniquesPathIds.includes(selectedProjection.path) &&
            selectedTrainIds.includes(selectedProjection.id)
          ) {
            setTrainResultsToFetch(undefined);
          } else {
            // We don't fetch anything
            setTrainResultsToFetch([]);
          }
        } else {
          setTrainResultsToFetch(undefined);
        }
        dispatch(updateSimulation({ trains: remainingTrains }));
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

  useEffect(() => {
    if (!multiselectOn) setSelectedTrainIds([]);
  }, [multiselectOn]);

  // Avoid keeping this on refresh
  useEffect(() => {
    dispatch(updateTrainScheduleIDsToModify([]));
  }, []);

  const toggleTagSelection = (tag: string | null) => {
    setSelectedTags((prevSelectedTags) => {
      const newSelectedTags = new Set(prevSelectedTags);
      if (newSelectedTags.has(tag)) {
        newSelectedTags.delete(tag);
      } else {
        newSelectedTags.add(tag);
      }
      return newSelectedTags;
    });
  };

  useEffect(() => {
    if (timetable && timetable.train_schedule_summaries) {
      const compositionCodes = timetable.train_schedule_summaries.map((train) =>
        extractTagCode(train.speed_limit_tags)
      );
      setUniqueTags(uniq(compositionCodes));
    }
  }, [timetable]);

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-addtrains-buttons">
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          data-testid="scenarios-import-train-schedule-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.import)}
        >
          <span className="mr-2">
            <Download />
          </span>
          {t('timetable.importTrainSchedule')}
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          data-testid="scenarios-add-train-schedule-button"
          onClick={() => {
            setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.add);
            dispatch(updateTrainScheduleIDsToModify([]));
          }}
        >
          <span className="mr-2">
            <Plus />
          </span>
          {t('timetable.addTrainSchedule')}
        </button>
      </div>
      <div className="scenario-timetable-toolbar justify-content-between">
        <div className="multi-select-buttons">
          {multiselectOn && (
            <>
              <input
                type="checkbox"
                className="mr-2"
                checked={selectedTrainIds.length === trainsList.length}
                onChange={() => selectAllTrains()}
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
          {multiselectOn && <span>{selectedTrainIds.length} / </span>}
          {t('trainCount', {
            count: trainsList.length,
          })}
        </div>
        <div className="d-flex">
          {!isEmpty(trainsList) && (
            <button
              aria-label={t('timetable.toggleMultiSelection')}
              type="button"
              className={cx('filter-selector', 'mr-1', { on: multiselectOn })}
              onClick={() => setMultiselectOn(!multiselectOn)}
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
        <div className="filter-panel">
          <div className="row">
            <div className="col-5">
              <InputSNCF
                type="text"
                id="timetable-label-filter"
                name="timetable-label-filter"
                label={t('timetable.filterLabel')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
                noMargin
                unit={<i className="icons-search" />}
                sm
                data-testid="timetable-label-filter"
                title={t('filterPlaceholder')}
              />
              <div className="my-3" />
              <InputSNCF
                type="text"
                id="timetable-rollingstock-filter"
                name="timetable-rollingstock-filter"
                label={t('timetable.advancedFilterLabel')}
                value={rollingStockFilter}
                onChange={(e) => setRollingStockFilter(e.target.value)}
                placeholder={t('timetable.rollingStockFilterPlaceholder')}
                noMargin
                unit={<i className="icons-search" />}
                sm
                data-testid="timetable-rollingstock-filter"
                title={t('timetable.rollingStockFilterPlaceholder')}
              />
            </div>

            <div className="col-7">
              <label htmlFor="train-validity">{t('timetable.validityFilter')}</label>
              <div className="validity-filter">
                <OptionsSNCF
                  onChange={handleValidityChange}
                  options={validityOptions}
                  name="train-validity"
                  selectedValue={validityFilter}
                />
              </div>

              <label htmlFor="composition-tag-filter">{t('timetable.compositionCodes')}</label>
              <div className="composition-tag-filter" id="composition-tag-filter">
                {uniqueTags.map((tag) => {
                  const displayTag = tag !== 'NO CODE' ? tag : t('timetable.noSpeedLimitTags');
                  return (
                    <button
                      className={cx('btn', 'btn-sm', { selectedTag: selectedTags.has(tag) })}
                      type="button"
                      key={tag}
                      onClick={() => toggleTagSelection(tag)}
                    >
                      {displayTag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': trainsWithDetails,
        })}
      >
        {trainsDurationsIntervals &&
          trainsList
            .sort((trainA, trainB) => trainA.departure_time - trainB.departure_time)
            .map((train: ScheduledTrain, idx: number) => (
              <TimetableTrainCard
                idx={idx}
                isSelectable={multiselectOn}
                isInSelection={selectedTrainIds.includes(train.id)}
                toggleTrainSelection={toggleTrainSelection}
                train={train}
                intervalPosition={valueToInterval(train.duration, trainsDurationsIntervals)}
                key={`timetable-train-card-${train.id}-${train.path_id}`}
                isSelected={infraState === 'CACHED' && selectedTrainId === train.id}
                isModified={trainScheduleIDsToModify.includes(train.id)}
                projectionPathIsUsed={
                  infraState === 'CACHED' &&
                  !!selectedProjection &&
                  selectedProjection.id === train.id
                }
                refetchTimetable={refetchTimetable}
                setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                setTrainResultsToFetch={setTrainResultsToFetch}
                simulation={simulation}
                selectedProjection={selectedProjection}
              />
            ))}
      </div>
      <div className="scenario-timetable-warnings">
        {timetableHasInvalidTrain(trainsList) && (
          <div className="invalid-trains">
            <Alert size="lg" variant="fill" />
            <span className="flex-grow-1">{t('timetable.invalidTrains')}</span>
          </div>
        )}
        {conflicts && (
          <ConflictsList
            conflicts={conflicts}
            expanded={conflictsListExpanded}
            toggleConflictsList={toggleConflictsListExpanded}
            onClick={handleConflictClick}
          />
        )}
      </div>
    </div>
  );
}
