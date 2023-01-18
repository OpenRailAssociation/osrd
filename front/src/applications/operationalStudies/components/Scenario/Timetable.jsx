import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TimetableTrainCard from './TimetableTrainCard';

function trainsDurations(trainList) {
  const durationList = trainList.map((train) => ({
    id: train.id,
    duration: train.arrival > train.departure ? train.arrival - train.departure : (train.arrival + 86400) - train.departure,
  }));
  const min = Math.min(...durationList.map((train) => train.duration));
  const max = Math.max(...durationList.map((train) => train.duration));
  // console.log(durationList.map((train) => train.duration), min, max);
  return durationList;
}

export default function Timetable() {
  const selectedProjection = useSelector((state) => state.osrdsimulation.selectedProjection);
  const departureArrivalTimes = useSelector((state) => state.osrdsimulation.departureArrivalTimes);
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const [filter, setFilter] = useState('');
  const { t } = useTranslation('operationalStudies/scenario');

  const trainList = trainsDurations(departureArrivalTimes);

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-toolbar">
        <div className="">
          {t('trainCount', { count: departureArrivalTimes ? departureArrivalTimes.length : 0 })}
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
          />
        </div>
        <button className="btn btn-primary btn-sm" type="button">
          <FaPlus />
        </button>
      </div>
      <div className="scenario-timetable-trains">
        {departureArrivalTimes
          ? departureArrivalTimes.map((train, idx) => (
              <TimetableTrainCard
                train={train}
                key={nextId()}
                selectedTrain={selectedTrain}
                selectedProjection={selectedProjection}
                idx={idx}
              />
            ))
          : null}
      </div>
    </div>
  );
}
