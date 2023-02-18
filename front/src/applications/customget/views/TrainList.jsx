import React, { useEffect, useState } from 'react';
import { sec2datetime, sec2time, time2datetime } from 'utils/timeManipulation';
import {
  updateMustRedraw,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { timeShiftTrain } from 'applications/customget/components/ChartHelpers';
import { useDebounce } from 'utils/helpers';
import { useTranslation } from 'react-i18next';

function InputName(props) {
  const { name, changeTrainName, idx, typeOfInputFocused } = props;
  const [localName, setLocalName] = useState(name);
  const handleChange = (value) => {
    setLocalName(value);
    changeTrainName(value, idx);
  };

  return (
    <InputSNCF
      type="text"
      id="trainlist-name"
      onChange={(e) => handleChange(e.target.value)}
      value={localName}
      noMargin
      focus={typeOfInputFocused === 'name'}
      sm
    />
  );
}

function InputTime(props) {
  const { time, changeTrainStartTime, idx, typeOfInputFocused } = props;
  const [localTime, setLocalTime] = useState(time);
  const handleChange = (value) => {
    setLocalTime(value);
    changeTrainStartTime(value, idx);
  };

  return (
    <InputSNCF
      type="time"
      id="trainlist-time"
      onChange={(e) => handleChange(e.target.value)}
      value={localTime}
      noMargin
      focus={typeOfInputFocused === 'time'}
      sm
    />
  );
}

export default function TrainsList() {
  const { selectedTrain, departureArrivalTimes } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();
  const [formattedList, setFormattedList] = useState(null);
  const [trainNameClickedIDX, setTrainNameClickedIDX] = useState(undefined);
  const [typeOfInputFocused, setTypeOfInputFocused] = useState(undefined);
  const [inputName, setInputName] = useState(undefined);
  const [inputTime, setInputTime] = useState(undefined);
  const [onInput, setOnInput] = useState(false);

  const { t } = useTranslation(['simulation']);

  const changeSelectedTrain = (idx, typeOfInputToFocus) => {
    dispatch(updateSelectedTrain(idx));
    setTrainNameClickedIDX(idx);
    setTypeOfInputFocused(typeOfInputToFocus);
    dispatch(updateMustRedraw(true));
  };

  const changeTrainName = (newName, idx) => {
    setOnInput(true);
    setInputName(newName);
    const newTrain = { ...simulation.trains[idx], name: newName };
    dispatch(
      updateSimulation({
        ...simulation,
        trains: simulation.trains.map((train, currentIdx) =>
          idx === currentIdx ? newTrain : train
        ),
      })
    );
  };

  const changeTrainStartTime = (newStartTime, idx) => {
    setOnInput(true);
    setInputTime(newStartTime);
    const offset = Math.floor(
      (time2datetime(newStartTime) - sec2datetime(simulation.trains[idx].base.stops[0].time)) / 1000
    );
    const trains = Array.from(simulation.trains);
    trains[idx] = timeShiftTrain(trains[selectedTrain], offset);
    dispatch(updateSimulation({ ...simulation, trains }));
  };

  const debouncedInputName = useDebounce(inputName, 500);
  const debouncedInputTime = useDebounce(inputTime, 500);

  const formatTrainsList = () => {
    const newFormattedList = departureArrivalTimes.map((train, idx) => (
      <tr className={selectedTrain === idx ? 'table-cell-selected' : null} key={nextId()}>
        <td>
          <div className="cell-inner">
            <i className="icons-slider-on" style={{ color: simulation.trains[idx].color }} />
          </div>
        </td>
        <td className="td-button">
          <div
            className="cell-inner cell-inner-button"
            role="button"
            onClick={() => changeSelectedTrain(idx, 'name', train.name, sec2time(train.departure))}
            tabIndex={0}
          >
            {trainNameClickedIDX === idx ? (
              <InputName
                idx={idx}
                changeTrainName={changeTrainName}
                name={train.name}
                typeOfInputFocused={typeOfInputFocused}
              />
            ) : (
              train.name
            )}
          </div>
        </td>
        <td>
          <div
            className="cell-inner cell-inner-button"
            role="button"
            onClick={() => changeSelectedTrain(idx, 'time', train.name, sec2time(train.departure))}
            tabIndex={0}
          >
            {trainNameClickedIDX === idx ? (
              <InputTime
                idx={idx}
                changeTrainStartTime={changeTrainStartTime}
                time={sec2time(train.departure)}
                typeOfInputFocused={typeOfInputFocused}
              />
            ) : (
              sec2time(train.departure)
            )}
          </div>
        </td>
        <td>
          <div className="cell-inner">{sec2time(train.arrival)}</div>
        </td>
      </tr>
    ));
    return newFormattedList;
  };

  useEffect(() => {
    if (debouncedInputName) {
      setOnInput(false);
      dispatch(updateMustRedraw(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInputName]);

  useEffect(() => {
    if (debouncedInputTime) {
      setOnInput(false);
      dispatch(updateMustRedraw(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInputTime]);

  useEffect(() => {
    if (!onInput) {
      setFormattedList(formatTrainsList());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrain, departureArrivalTimes, trainNameClickedIDX, typeOfInputFocused]);

  return (
    <>
      <div className="mb-2 row">
        <div className="col-md-6 col-4">
          <span className="h2 flex-grow-2">
            {`${t('simulation:trainList')} (${departureArrivalTimes.length})`}
          </span>
        </div>
      </div>
      <div className="table-wrapper simulation-trainlist">
        <div className="table-scroller dragscroll">
          <table className="table table-hover">
            <thead className="thead thead-light">
              <tr>
                <th scope="col" colSpan="2">
                  <div className="cell-inner">{t('simulation:name')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:start')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:stop')}</div>
                </th>
              </tr>
            </thead>
            <tbody>{formattedList}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

InputName.propTypes = {
  changeTrainName: PropTypes.func.isRequired,
  idx: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  typeOfInputFocused: PropTypes.string.isRequired,
};

InputTime.propTypes = {
  changeTrainStartTime: PropTypes.func.isRequired,
  idx: PropTypes.number.isRequired,
  time: PropTypes.string.isRequired,
  typeOfInputFocused: PropTypes.string.isRequired,
};
