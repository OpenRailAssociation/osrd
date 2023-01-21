import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { trainscheduleURI } from 'applications/operationalStudies/components/Simulation/consts';
import { updateMustRedraw, updateSelectedTrain } from 'reducers/osrdsimulation/actions';
import { deleteRequest } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import Loader from 'common/Loader';
import getTimetable from './getTimetable';
import TimetableTrainCard from './TimetableTrainCard';
import { simulationIsUpdating } from './helpers';

function trainsDurations(trainList) {
  const durationList = trainList.map((train) => ({
    id: train.id,
    duration:
      train.arrival > train.departure
        ? train.arrival - train.departure
        : train.arrival + 86400 - train.departure,
  }));
  const min = Math.min(...durationList.map((train) => train.duration));
  const max = Math.max(...durationList.map((train) => train.duration));
  // console.log(durationList.map((train) => train.duration), min, max);
  return durationList;
}

export default function Timetable() {
  const isUpdating = useSelector((state) => state.osrdsimulation.isUpdating);
  const selectedProjection = useSelector((state) => state.osrdsimulation.selectedProjection);
  const departureArrivalTimes = useSelector((state) => state.osrdsimulation.departureArrivalTimes);
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const [filter, setFilter] = useState('');
  const [trainsList, setTrainsList] = useState();
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');

  const debouncedTerm = useDebounce(filter, 500);
  // const trainList = trainsDurations(departureArrivalTimes);

  const changeSelectedTrain = (idx) => {
    dispatch(updateSelectedTrain(idx));
    dispatch(updateMustRedraw(true));
  };

  const deleteTrain = async (train) => {
    try {
      await deleteRequest(`${trainscheduleURI}${train.id}/`);
      getTimetable(simulationIsUpdating);
      dispatch(
        setSuccess({
          title: t('timetable:trainDeleted', { name: train.name }),
          text: '',
        })
      );
    } catch (e) {
      console.log('ERROR', e);
      dispatch(
        setFailure({
          name: e.name,
          message: e.message,
        })
      );
    }
  };

  useEffect(() => {
    if (debouncedTerm !== '' && departureArrivalTimes) {
      setTrainsList(departureArrivalTimes.filter((train) => train.name.includes(debouncedTerm)));
    } else {
      setTrainsList(departureArrivalTimes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureArrivalTimes, debouncedTerm]);

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-toolbar">
        <div className="">{t('trainCount', { count: trainsList ? trainsList.length : 0 })}</div>
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
          />
        </div>
        <button className="btn btn-primary btn-sm" type="button">
          <FaPlus />
        </button>
      </div>
      <div className="scenario-timetable-trains">
        {trainsList && !isUpdating
          ? trainsList.map((train, idx) => (
              <TimetableTrainCard
                train={train}
                key={nextId()}
                selectedTrain={selectedTrain}
                selectedProjection={selectedProjection}
                idx={idx}
                changeSelectedTrain={changeSelectedTrain}
                deleteTrain={deleteTrain}
              />
            ))
          : null}
        {isUpdating && <Loader />}
      </div>
    </div>
  );
}
