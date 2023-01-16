import React, { useState } from 'react';
import { updateMustRedraw, updateSelectedTrain } from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import { changeTrain } from 'applications/operationalStudies/components/TrainList/TrainListHelpers';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TimetableTrainCard from './TimetableTrainCard';

export default function Timetable() {
  const selectedProjection = useSelector((state) => state.osrdsimulation.selectedProjection);
  const departureArrivalTimes = useSelector((state) => state.osrdsimulation.departureArrivalTimes);
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const [filter, setFilter] = useState('');
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');

  const changeSelectedTrain = (idx) => {
    dispatch(updateSelectedTrain(idx));
    dispatch(updateMustRedraw(true));
  };

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
