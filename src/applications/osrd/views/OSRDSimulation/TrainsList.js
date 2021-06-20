import React, { useState, useEffect } from 'react';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { sec2time } from 'utils/timeManipulation';

const TrainsList = (props) => {
  const {
    selectedTrain, setMustRedraw, setSelectedTrain, simulation,
  } = props;
  const [formattedList, setFormattedList] = useState(undefined);

  const { t } = useTranslation(['simulation']);

  const changeSelectedTrain = (idx) => {
    setMustRedraw(true);
    setSelectedTrain(idx);
  };

  const formatTrainsList = () => {
    const newFormattedList = simulation.trains.map((train, idx) => {
      let start = '00:00:00';
      let stop = '00:00:00';
      train.stops.forEach((step) => {
        if (step.name === 'start') { start = step.time; }
        if (step.name === 'stop') { stop = step.time; }
      });
      return (
        <tr
          className={selectedTrain === idx ? 'table-cell-selected' : null}
          role="button"
          onClick={() => changeSelectedTrain(idx)}
          key={nextId()}
        >
          <td><div className="cell-inner">{train.name}</div></td>
          <td><div className="cell-inner">{sec2time(start)}</div></td>
          <td><div className="cell-inner">{sec2time(stop)}</div></td>
        </tr>
      );
    });
    return newFormattedList;
  };

  useEffect(() => {
    setFormattedList(formatTrainsList(simulation, selectedTrain, setSelectedTrain));
  }, [selectedTrain, simulation]);

  return (
    <>
      <div className="h2 mb-2">{t('simulation:trainList')}</div>
      <div className="table-wrapper">
        <div className="table-scroller dragscroll">
          <table className="table table-hover">
            <thead className="thead thead-light">
              <tr>
                <th scope="col"><div className="cell-inner">{t('simulation:name')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:start')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:stop')}</div></th>
              </tr>
            </thead>
            <tbody>
              {formattedList !== undefined ? formattedList : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

TrainsList.propTypes = {
  simulation: PropTypes.object.isRequired,
  selectedTrain: PropTypes.number.isRequired,
  setMustRedraw: PropTypes.func.isRequired,
  setSelectedTrain: PropTypes.func.isRequired,
};

export default TrainsList;
