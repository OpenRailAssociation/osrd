import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaPlus } from 'react-icons/fa';
import PropTypes from 'prop-types';

import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import {
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
} from 'reducers/osrdsimulation/actions';
import { deleteRequest, get, post } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import trainNameWithNum from 'applications/operationalStudies/components/ManageTrainSchedule/AddTrainSchedule/trainNameHelper';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { getTimetableID } from 'reducers/osrdconf/selectors';
import getTimetable from './getTimetable';
import TimetableTrainCard from './TimetableTrainCard';

/* function trainsDurations(trainList) {
  const durationList = trainList.map((train) => ({
    id: train.id,
    duration:
      train.arrival > train.departure
        ? train.arrival - train.departure
        : train.arrival + 86400 - train.departure,
  }));
  const min = Math.min(...durationList.map((train) => train.duration));
  const max = Math.max(...durationList.map((train) => train.duration));
  return durationList;
} */

export default function Timetable(props) {
  const { setDisplayTrainScheduleManagement } = props;
  const selectedProjection = useSelector((state) => state.osrdsimulation.selectedProjection);
  const departureArrivalTimes = useSelector((state) => state.osrdsimulation.departureArrivalTimes);
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const timetableID = useSelector(getTimetableID);
  const [filter, setFilter] = useState('');
  const [trainsList, setTrainsList] = useState();
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/scenario']);

  const debouncedTerm = useDebounce(filter, 500);

  const changeSelectedTrain = (idx) => {
    dispatch(updateSelectedTrain(idx));
    dispatch(updateMustRedraw(true));
  };

  const deleteTrain = async (train) => {
    try {
      await deleteRequest(`${trainscheduleURI}${train.id}/`);
      getTimetable(timetableID);
      dispatch(
        setSuccess({
          title: t('timetable.trainDeleted', { name: train.name }),
          text: '',
        })
      );
    } catch (e) {
      console.error(e);
      dispatch(
        setFailure({
          name: e.name,
          message: e.message,
        })
      );
    }
  };

  const duplicateTrain = async (train) => {
    // Static for now, will be dynamic when UI will be ready
    const trainName = `${train.name} (${t('timetable.copy')})`;
    const trainDelta = 5;
    const trainCount = 1;
    const trainStep = 5;
    //

    const trainDetail = await get(`${trainscheduleURI}${train.id}/`);
    const params = {
      timetable: trainDetail.timetable,
      path: trainDetail.path,
      schedules: [],
    };
    let actualTrainCount = 1;
    for (let nb = 1; nb <= trainCount; nb += 1) {
      const newTrainDelta = 60 * trainDelta * nb;
      const newOriginTime = train.departure + newTrainDelta;
      const newTrainName = trainNameWithNum(trainName, actualTrainCount, trainCount);
      params.schedules.push({
        departure_time: newOriginTime,
        initial_speed: trainDetail.initial_speed,
        labels: trainDetail.labels,
        rolling_stock: trainDetail.rolling_stock,
        train_name: newTrainName,
        allowances: trainDetail.allowances,
        speed_limit_tags: trainDetail.speed_limit_tags,
      });
      actualTrainCount += trainStep;
    }
    try {
      await post(`${trainscheduleURI}standalone_simulation/`, params);
      getTimetable(timetableID);
      dispatch(
        setSuccess({
          title: t('timetable.trainAdded'),
          text: `${trainName}`,
        })
      );
    } catch (e) {
      console.error(e);
      dispatch(
        setFailure({
          name: e.name,
          message: e.message,
        })
      );
    }
  };

  const selectPathProjection = async (train) => {
    if (train) {
      dispatch(
        updateSelectedProjection({
          id: train.id,
          path: train.path,
        })
      );
    }
  };

  useEffect(() => {
    if (debouncedTerm !== '' && departureArrivalTimes) {
      setTrainsList(
        departureArrivalTimes.map((train) => ({
          ...train,
          isFiltered: !train.name.toLowerCase().includes(debouncedTerm.toLowerCase()),
        }))
      );
    } else {
      setTrainsList(departureArrivalTimes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureArrivalTimes, debouncedTerm]);

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-addtrains-buttons">
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          data-testid="scenarios-import-train-schedule-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.opendata)}
        >
          <span className="mr-2">
            <FaDownload />
          </span>
          {t('timetable.importTrainSchedule')}
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          data-testid="scenarios-add-train-schedule-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.add)}
        >
          <span className="mr-2">
            <FaPlus />
          </span>
          {t('timetable.addTrainSchedule')}
        </button>
      </div>
      <div className="scenario-timetable-toolbar">
        <div className="small">
          {t('trainCount', {
            count: trainsList ? trainsList.filter((train) => !train.isFiltered).length : 0,
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
            unit={<i className="icons-search" />}
            sm
            data-testid="scenarios-filter"
          />
        </div>
      </div>
      <div className="scenario-timetable-trains">
        {trainsList &&
          selectedProjection &&
          trainsList.map((train, idx) =>
            !train.isFiltered ? (
              <TimetableTrainCard
                train={train}
                key={nextId()}
                isSelected={selectedTrain === idx}
                projectionPathIsUsed={selectedProjection.id === train.id}
                idx={idx}
                changeSelectedTrain={changeSelectedTrain}
                deleteTrain={deleteTrain}
                duplicateTrain={duplicateTrain}
                selectPathProjection={selectPathProjection}
              />
            ) : null
          )}
      </div>
    </div>
  );
}

Timetable.propTypes = {
  setDisplayTrainScheduleManagement: PropTypes.func.isRequired,
};
