import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { BiSelectMultiple } from 'react-icons/bi';
import { Alert, Download, Plus, Search, Trash } from '@osrd-project/ui-icons';
import { isEmpty, uniq } from 'lodash';
import cx from 'classnames';

import { useDebounce } from 'utils/helpers';
import { valueToInterval } from 'utils/numbers';
import { durationInSeconds } from 'utils/timeManipulation';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';

import ConflictsList from 'modules/conflict/components/ConflictsList';
import findTrainsDurationsIntervals from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainsDurationsIntervals';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import TimetableTrainCard from 'modules/trainschedule/components/Timetable/TimetableTrainCard';
import type {
  Conflict,
  Infra,
  SimulationReport,
  TimetableWithSchedulesDetails,
} from 'common/api/osrdEditoastApi';

import { useAppDispatch } from 'store';
import { setFailure, setSuccess } from 'reducers/main';
import type { ScheduledTrain, SimulationSnapshot } from 'reducers/osrdsimulation/types';
import { updateSelectedTrainId, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getSelectedProjection } from 'reducers/osrdsimulation/selectors';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';

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

type RollingStocksDictionary = {
  [key: string]: number[];
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
  const [rollingStockIds, setRollingStockIds] = useState<number[]>([]);
  const [rollingStocksDictionary, setRollingStocksDictionary] = useState<RollingStocksDictionary>(
    {}
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showValidTrains, setShowValidTrains] = useState(true);
  const [showInvalidTrains, setShowInvalidTrains] = useState(true);
  const [tags, setTags] = useState<string[]>([]);

  const { openModal } = useContext(ModalContext);

  const dispatch = useAppDispatch();

  const debouncedTerm = useDebounce(filter, 500) as string;

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

  const { data: { results: rollingStocks } = { results: [] } } =
    enhancedEditoastApi.useGetLightRollingStockQuery({ pageSize: 1000 });

  useEffect(() => {
    const rollingStockIdsSet = new Set(rollingStockIds);
    const newRollingStocksDictionary: RollingStocksDictionary = {};

    rollingStocks.forEach((rollingStock) => {
      if (rollingStockIdsSet.has(rollingStock.id)) {
        const { metadata } = rollingStock;
        if (metadata) {
          if (metadata.detail) {
            if (!newRollingStocksDictionary[metadata.detail]) {
              newRollingStocksDictionary[metadata.detail] = [];
            }
            newRollingStocksDictionary[metadata.detail].push(rollingStock.id);
          }
          if (metadata.series) {
            if (!newRollingStocksDictionary[metadata.series]) {
              newRollingStocksDictionary[metadata.series] = [];
            }
            newRollingStocksDictionary[metadata.series].push(rollingStock.id);
          }
          if (metadata.family) {
            if (!newRollingStocksDictionary[metadata.family]) {
              newRollingStocksDictionary[metadata.family] = [];
            }
            newRollingStocksDictionary[metadata.family].push(rollingStock.id);
          }
        }
      }
    });

    setRollingStocksDictionary(newRollingStocksDictionary);
  }, [rollingStocks, rollingStockIds]);

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

  const trainsList = useMemo(() => {
    if (timetable) {
      return timetable.train_schedule_summaries
        .filter((train) => keepTrain(train, debouncedTerm))
        .map((train) => ({
          ...train,
          duration: durationInSeconds(train.departure_time, train.arrival_time),
        }));
    }
    return [];
  }, [timetable, trainsDurationsIntervals, debouncedTerm]);

  useEffect(() => {
    const extractedRollingStockIds = trainsList.map((train) => train.rolling_stock_id);
    setRollingStockIds(extractedRollingStockIds);
  }, [trainsList]);

  const trainsWithRollingStockDetail = useMemo(
    () =>
      trainsList.map((train) => {
        const rollingStock = rollingStocks.find((rs) => rs.id === train.rolling_stock_id);
        const rollingStockMetadata = rollingStock?.metadata;
        const rollingStockName = rollingStock?.name;
        return { ...train, rollingStockMetadata, rollingStockName };
      }),
    [trainsList, rollingStocks]
  );

  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

  const timetableHasInvalidTrain = (trains: ScheduledTrain[]) =>
    trains.some((train) => train.invalid_reasons && train.invalid_reasons.length > 0);

  const toggleTrainSelection = (id: number) => {
    const currentSelectedTrainIds = [...selectedTrainIds];
    const index = currentSelectedTrainIds.indexOf(id); // Find the index of the ID in the array

    if (index === -1) {
      currentSelectedTrainIds.push(id);
    } else {
      currentSelectedTrainIds.splice(index, 1);
    }

    setSelectedTrainIds(currentSelectedTrainIds);
  };

  const handleShowValidTrainsChange = (checked: boolean) => {
    if (!checked && !showInvalidTrains) {
      // Prevent unchecking if the other checkbox is already unchecked
      return;
    }
    setShowValidTrains(checked);
  };

  const handleShowInvalidTrainsChange = (checked: boolean) => {
    if (!checked && !showValidTrains) {
      // Prevent unchecking if the other checkbox is already unchecked
      return;
    }
    setShowInvalidTrains(checked);
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
      .catch((e: unknown) => {
        console.error(e);
        if (selectedTrainId && selectedTrainIds.includes(selectedTrainId)) {
          dispatch(updateSelectedTrainId(selectedTrainId));
        }
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
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

  const specialCodeDictionary: { [key: string]: string } = {
    'Divers - Haut le pied': 'HLP',
    '': 'NO CODE',
  };

  // const getSpecialCodeDictionary = () => ({
  //   'Divers - Haut le pied': 'HLP',
  //   '': t('yourTranslationKeyForNoCode'), // Use the translation key here
  // });

  const extractTagCode = (tag: string | null) => {
    // const specialCodeDictionary = getSpecialCodeDictionary();

    if (!tag) {
      return 'NO CODE'; // Return 'NO CODE' when tag is null or undefined
    }
    if (tag in specialCodeDictionary) {
      return specialCodeDictionary[tag];
    }

    const regex = /\s*(\w+)\s*$/;
    const matches = tag.match(regex);
    if (matches && matches[1]) {
      return matches[1];
    }

    return tag;
  };

  const [uniqueTags, setUniqueTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState(new Set());

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

  const filteredTrainsList = useMemo(
    () =>
      trainsWithRollingStockDetail
        .filter((train) => keepTrain(train, debouncedTerm))
        .filter(
          (train) =>
            (showValidTrains &&
              !showInvalidTrains &&
              (!train.invalid_reasons || train.invalid_reasons.length === 0)) ||
            (!showValidTrains &&
              showInvalidTrains &&
              train.invalid_reasons &&
              train.invalid_reasons.length > 0) ||
            (showValidTrains && showInvalidTrains)
        )
        .filter(
          (train) =>
            selectedTags.size === 0 || selectedTags.has(extractTagCode(train.speed_limit_tags))
        )
        .filter(
          (train) =>
            tags.length === 0 ||
            tags.some((tag) =>
              tag === 'NO CODE'
                ? !train.speed_limit_tags
                : rollingStocksDictionary[tag]?.includes(train.rolling_stock_id)
            )
        ),
    [
      trainsWithRollingStockDetail,
      debouncedTerm,
      showValidTrains,
      showInvalidTrains,
      selectedTags,
      tags,
      rollingStocksDictionary,
    ]
  );

  useEffect(() => {
    const compositionCodes = new Set<string>();
    trainsList.forEach((train) => {
      const tagCode = train.speed_limit_tags ? extractTagCode(train.speed_limit_tags) : 'NO CODE';
      compositionCodes.add(tagCode);
    });
    setUniqueTags(Array.from(compositionCodes));
  }, [trainsList]);

  const addTag = (newTag: string) => {
    if (newTag in rollingStocksDictionary && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
  };

  const removeTag = (tagIdx: number) => {
    setTags(tags.filter((_, idx) => idx !== tagIdx));
  };

  const [chipInputValue, setChipInputValue] = useState('');

  const handleChipInputChange = (value: string) => {
    setChipInputValue(value);

    // Update suggestions based on the input value
    if (value) {
      const filteredSuggestions = Object.keys(rollingStocksDictionary).filter((key) =>
        key.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    setChipInputValue('');
    setSuggestions([]);
  };

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
      <div className="scenario-timetable-toolbar">
        {multiselectOn && (
          <input
            type="checkbox"
            className="mr-2"
            checked={selectedTrainIds.length === trainsList.length}
            onChange={() => selectAllTrains()}
          />
        )}
        <div className="small">
          {multiselectOn && <span>{selectedTrainIds.length} / </span>}
          {t('trainCount', {
            count: trainsList.length,
          })}
        </div>
        <div className="flex-grow-1">
          <InputSNCF
            type="text"
            id="scenarios-filter"
            name="scenarios-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('filterPlaceholder')}
            whiteBG
            noMargin
            unit={<Search />}
            sm
            data-testid="scenarios-filter"
          />
        </div>
        {!isEmpty(trainsList) && (
          <button
            type="button"
            className={cx('multiselect-toggle', { on: multiselectOn })}
            aria-label={t('timetable.toggleMultiSelection')}
            title={t('timetable.toggleMultiSelection')}
            onClick={() => setMultiselectOn(!multiselectOn)}
          >
            <BiSelectMultiple />
          </button>
        )}

        {multiselectOn && (
          <button
            disabled={!selectedTrainIds.length}
            type="button"
            className={cx('multiselect-delete', { disabled: !selectedTrainIds.length })}
            aria-label={t('timetable.deleteSelection')}
            title={t('timetable.deleteSelection')}
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
        )}
      </div>
      <div className="validity-filter-checkboxes">
        <label htmlFor="showValidTrainsCheckbox">
          <input
            id="showValidTrainsCheckbox"
            type="checkbox"
            checked={showValidTrains}
            onChange={(e) => handleShowValidTrainsChange(e.target.checked)}
          />
          {t('timetable.showValidTrains')}
        </label>
        <label htmlFor="showInvalidTrainsCheckbox">
          <input
            id="showInvalidTrainsCheckbox"
            type="checkbox"
            checked={showInvalidTrains}
            onChange={(e) => handleShowInvalidTrainsChange(e.target.checked)}
          />
          {t('timetable.showInvalidTrains')}
        </label>
      </div>
      <div>
        <ChipsSNCF
          addTag={addTag}
          tags={tags}
          removeTag={removeTag}
          color="green"
          chipInputValue={chipInputValue}
          setChipInputValue={handleChipInputChange}
          placeholder={t('advancedFiltersPlaceholder')}
          containerColorClass="white"
        />
        {suggestions.length > 0 && (
          <ul className="autocomplete-suggestions">
            {suggestions.map((suggestion, idx) => (
              <li key={idx}>
                <button type="button" onClick={() => handleSuggestionClick(suggestion)}>
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': trainsWithDetails,
        })}
      >
        <div>
          <span>{t('timetable.compositionCodes')}:</span>
          {uniqueTags.map((tag) => {
            // Translate tag here
            let displayTag = tag;
            if (tag === 'NO CODE') {
              displayTag = t('timetable.noSpeedLimitTags');
            }
            return (
              <button
                className={`btn btn-sm m-1 ${
                  selectedTags.has(tag) ? 'btn btn-sm selected-tags' : ''
                }`}
                type="button"
                key={tag}
                onClick={() => toggleTagSelection(tag)}
              >
                {displayTag}
              </button>
            );
          })}
        </div>
        {trainsDurationsIntervals &&
          filteredTrainsList
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
