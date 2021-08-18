import React, { useState, useEffect } from 'react';
import * as d3 from 'd3';
import { useSelector, useDispatch } from 'react-redux';
import { updateHoverPosition, updateTimePosition } from 'reducers/osrdsimulation';
import {
  FaStop, FaPause, FaPlay, FaBackward,
} from 'react-icons/fa';
import { sec2time, time2sec } from 'utils/timeManipulation';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TimeLine from 'applications/osrd/components/TimeLine/TimeLine';

// transform a speed ratio (X2 X10 X20, etc.) to interval time & step to bypass
const factor2ms = (factor) => {
  const ms = Math.round(1000 / factor);
  const steps = (ms < 100) ? Math.round((1 / ms) * 100) : 1;
  return { ms, steps };
};

export default function TimeButtons() {
  const dispatch = useDispatch();
  const {
    hoverPosition, selectedTrain, simulation, timePosition, chart,
  } = useSelector((state) => state.osrdsimulation);
  const [playInterval, setPlayInterval] = useState(undefined);
  const [playState, setPlayState] = useState(hoverPosition);
  const [playReverse, setPlayReverse] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const simulationLength = simulation.trains[selectedTrain].steps.length;

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

  const changeTimePosition = (e) => {
    if (simulation.trains[selectedTrain]) {
      const bisect = d3.bisector((d) => d.time).left;
      dispatch(
        updateHoverPosition(
          bisect(simulation.trains[selectedTrain].steps, time2sec(e.target.value), 1),
        ),
      );
    }
    dispatch(updateTimePosition(e.target.value));
  };

  useEffect(() => {
    setPlayState(hoverPosition);
  }, [hoverPosition]);

  return (
    <div className="d-flex align-items-start">
      <span className="mr-1">
        <InputSNCF
          noMargin
          type="time"
          id="simulation-time"
          value={timePosition}
          onChange={changeTimePosition}
        />
      </span>
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
      <InputSNCF
        noMargin
        type="number"
        id="simulation-speed"
        value={simulationSpeed}
        onChange={(e) => changeSimulationSpeed(e.target.value)}
        seconds
      />
      <div className="timeline-container flex-grow-1 w-100 ml-2">
        <div className="timeline w-100">
          <TimeLine />
        </div>
      </div>
    </div>
  );
}
