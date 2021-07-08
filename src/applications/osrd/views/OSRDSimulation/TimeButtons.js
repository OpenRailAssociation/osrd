import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateHoverPosition } from 'reducers/osrdsimulation';
import PropTypes from 'prop-types';
import { sec2time } from 'utils/timeManipulation';
import {
  FaStop, FaPause, FaPlay, FaBackward,
} from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

// transform a speed ratio (X2 X10 X20, etc.) to interval time & step to bypass
const factor2ms = (factor) => {
  const ms = Math.round(1000 / factor);
  const steps = (ms < 100) ? Math.round((1 / ms) * 100) : 1;
  return { ms, steps };
};

export default function TimeButtons(props) {
  const {
    simulation, selectedTrain, simulationLength,
  } = props;
  const dispatch = useDispatch();
  const { hoverPosition } = useSelector((state) => state.osrdsimulation);
  const [playInterval, setPlayInterval] = useState(undefined);
  const [playState, setPlayState] = useState(0);
  const [playReverse, setPlayReverse] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);

  const stop = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    setPlayState(0);
    dispatch(updateHoverPosition(0));
  };
  const pause = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
  };
  const play = (playReverseLocal, simulationSpeedLocal = simulationSpeed) => {
    clearInterval(playInterval); // Kill interval playing if concerned
    setPlayInterval(undefined);
    const factor = factor2ms(simulationSpeedLocal);
    let i = (playReverseLocal && playState === 0) ? simulationLength : playState;
    const playIntervalLocal = setInterval(() => {
      dispatch(updateHoverPosition(i));
      if (playReverseLocal) {
        i -= factor.steps;
      } else {
        i += factor.steps;
      }
      if (i >= simulationLength || i < 0) {
        clearInterval(playIntervalLocal);
        setPlayInterval(undefined);
        setPlayState(0);
      } else {
        setPlayState(i);
      }
    }, factor.ms);
    setPlayInterval(playIntervalLocal);
    setPlayState(0);
  };

  const changeReverse = () => {
    setPlayReverse(!playReverse);
    if (playInterval) {
      play(!playReverse);
    }
  };

  const changeSimulationSpeed = (speedFactor) => {
    setSimulationSpeed(speedFactor);
    if (playInterval) {
      play(playReverse, speedFactor);
    }
  };

  return (
    <div className="d-flex">
      <button type="button" disabled className="btn btn-disabled font-weight-bold mr-1">
        <i className="icons-clock mr-2" />
        {simulation.trains[selectedTrain].steps[hoverPosition]
          ? sec2time(simulation.trains[selectedTrain].steps[hoverPosition].time) : '--:--:--'}
      </button>
      <button
        type="button"
        className="btn btn-only-icon btn-danger mr-1"
        onClick={stop}
      >
        <FaStop />
      </button>
      <button
        type="button"
        className={`btn btn-only-icon mr-1 ${playReverse ? 'btn-primary' : 'btn-white'}`}
        onClick={changeReverse}
      >
        <FaBackward />
      </button>
      {playInterval ? (
        <button
          type="button"
          className="btn btn-only-icon btn-warning mr-1"
          onClick={pause}
        >
          <FaPause />
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-only-icon btn-success mr-1"
          onClick={() => play(playReverse)}
        >
          <FaPlay />
        </button>
      )}
      <button type="button" disabled className="btn btn-disabled font-weight-bold">
        <i className="icons-close" />
      </button>
      <InputSNCF
        noMargin
        type="number"
        id="simulation-speed"
        value={simulationSpeed}
        onChange={(e) => changeSimulationSpeed(e.target.value)}
        seconds
      />
      <div className="timeline-container flex-grow-1">
        <div className="timeline">
          test
        </div>
      </div>
    </div>
  );
}

TimeButtons.propTypes = {
  simulationLength: PropTypes.number.isRequired,
  simulation: PropTypes.object.isRequired,
  selectedTrain: PropTypes.number.isRequired,
};
