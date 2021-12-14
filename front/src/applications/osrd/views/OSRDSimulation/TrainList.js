import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import {
  time2datetime, sec2time, sec2datetime, time2sec,
} from 'utils/timeManipulation';
import { updateMustRedraw, updateSelectedTrain, updateSimulation } from 'reducers/osrdsimulation';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TrainListModal from 'applications/osrd/components/TrainList/TrainListModal';
import { IoMdEye } from 'react-icons/io';
import { useDebounce } from 'utils/helpers';
import { timeShiftTrain } from 'applications/osrd/components/Helpers/ChartHelpers';
import { changeTrain } from 'applications/osrd/components/TrainList/TrainListHelpers';

const InputName = (props) => {
  const {
    name, changeTrainName, idx, typeOfInputFocused,
  } = props;
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
};

const InputTime = (props) => {
  const {
    time, changeTrainStartTime, idx, typeOfInputFocused,
  } = props;
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
};

export default function TrainsList(props) {
  const { toggleTrainList } = props;
  const {
    selectedProjection, selectedTrain, simulation,
  } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();
  const [formattedList, setFormattedList] = useState(null);
  const [filter, setFilter] = useState('');
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
    dispatch(updateSimulation({
      ...simulation,
      trains: simulation.trains.map((train, currentIdx) => (
        (idx === currentIdx) ? newTrain : train)),
    }));
  };

  const changeTrainStartTime = (newStartTime, idx) => {
    setOnInput(true);
    setInputTime(newStartTime);
    const offset = Math.floor(
      (time2datetime(newStartTime) - sec2datetime(
        simulation.trains[idx].base.stops[0].time,
      )) / 1000,
    );
    const trains = Array.from(simulation.trains);
    trains[idx] = timeShiftTrain(trains[selectedTrain], offset);
    dispatch(updateSimulation({ ...simulation, trains }));
  };

  const debouncedInputName = useDebounce(inputName, 500);
  const debouncedInputTime = useDebounce(inputTime, 500);

  const formatTrainsList = () => {
    const newFormattedList = simulation.trains.map((train, idx) => {
      if (filter === '' || (train.labels !== undefined && train.labels.join().toLowerCase().includes(filter.toLowerCase()))) {
        return (
          <tr
            className={selectedTrain === idx ? 'table-cell-selected' : null}
            key={nextId()}
          >
            <td>
              <div className="cell-inner">
                <div className="custom-control custom-checkbox custom-checkbox-alone">
                  <input type="checkbox" className="custom-control-input" id={`timetable-train-${idx}`} />
                  <label className="custom-control-label" htmlFor={`timetable-train-${idx}`} />
                </div>
              </div>
            </td>
            <td>
              <div className="cell-inner">
                {train.id === selectedProjection.id && '🎢'}
              </div>
            </td>
            <td className="td-button">
              <div
                className="cell-inner cell-inner-button"
                role="button"
                onClick={() => changeSelectedTrain(idx, 'name', train.name, sec2time(train.base.stops[0].time))}
                tabIndex={0}
              >
                {trainNameClickedIDX === idx ? (
                  <InputName
                    idx={idx}
                    changeTrainName={changeTrainName}
                    name={train.name}
                    typeOfInputFocused={typeOfInputFocused}
                  />
                ) : train.name}
              </div>
            </td>
            <td>
              <div
                className="cell-inner cell-inner-button"
                role="button"
                onClick={() => changeSelectedTrain(idx, 'time', train.name, sec2time(train.base.stops[0].time))}
                tabIndex={0}
              >
                {trainNameClickedIDX === idx ? (
                  <InputTime
                    idx={idx}
                    changeTrainStartTime={changeTrainStartTime}
                    time={sec2time(train.base.stops[0].time)}
                    typeOfInputFocused={typeOfInputFocused}
                  />
                ) : sec2time(train.base.stops[0].time)}
              </div>
            </td>
            <td><div className="cell-inner">{sec2time(train.base.stops[train.base.stops.length - 1].time)}</div></td>
            <td><div className="cell-inner">{train.labels && train.labels.join(' / ')}</div></td>
            <td>
              <div className="cell-inner">
                <button
                  type="button"
                  data-toggle="modal"
                  data-target="#trainlist-modal"
                  className="btn btn-only-icon btn-transparent btn-color-gray pl-0"
                >
                  <i className="icons-pencil" />
                </button>
                <button
                  type="button"
                  className="btn btn-only-icon btn-transparent btn-color-gray px-0"
                >
                  <IoMdEye />
                </button>
              </div>
            </td>
          </tr>
        );
      }
      return null;
    });
    return newFormattedList;
  };

  useEffect(() => {
    if (debouncedInputName) {
      setOnInput(false);
      changeTrain(
        { train_name: debouncedInputName },
        simulation.trains[trainNameClickedIDX].id,
      );
      dispatch(updateMustRedraw(true));
    }
  }, [debouncedInputName]);

  useEffect(() => {
    if (debouncedInputTime) {
      setOnInput(false);
      changeTrain(
        { departure_time: time2sec(debouncedInputTime) },
        simulation.trains[trainNameClickedIDX].id,
      );
      dispatch(updateMustRedraw(true));
    }
  }, [debouncedInputTime]);

  useEffect(() => {
    if (!onInput) {
      setFormattedList(formatTrainsList());
    }
  }, [selectedTrain, simulation, filter, trainNameClickedIDX, typeOfInputFocused]);

  return (
    <>
      <div className="mb-2 row">
        <div className="col-md-6 col-4">
          <span className="h2 flex-grow-2">{t('simulation:trainList')}</span>
        </div>
        <div className="col-md-6 col-8 d-flex">
          <div className="flex-grow-1">
            <InputSNCF
              type="text"
              placeholder={t('simulation:placeholderlabel')}
              id="labels-filter"
              onChange={(e) => setFilter(e.target.value)}
              onClear={() => setFilter('')}
              value={filter}
              clearButton
              noMargin
              sm
            />
          </div>
          <button
            type="button"
            className="ml-1 btn btn-primary btn-only-icon btn-sm"
            onClick={toggleTrainList}
          >
            <i className="icons-arrow-up" />
          </button>
        </div>
      </div>
      <div className="table-wrapper simulation-trainlist">
        <div className="table-scroller dragscroll">
          <table className="table table-hover">
            <thead className="thead thead-light">
              <tr>
                <th>
                  <div className="cell-inner">
                    <div className="custom-control custom-checkbox custom-checkbox-alone">
                      <input type="checkbox" className="custom-control-input" id="timetable-sel-all-trains" />
                      <label className="custom-control-label" htmlFor="timetable-sel-all-trains">
                        <span className="sr-only">Select all</span>
                      </label>
                    </div>
                  </div>
                </th>
                <th scope="col" colSpan="2"><div className="cell-inner">{t('simulation:name')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:start')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:stop')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:labels')}</div></th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {formattedList}
            </tbody>
          </table>
        </div>
      </div>
      {/* <TrainListModal
        trainIDX={trainIDX}
      /> */}
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

TrainsList.propTypes = {
  toggleTrainList: PropTypes.func.isRequired,
};
