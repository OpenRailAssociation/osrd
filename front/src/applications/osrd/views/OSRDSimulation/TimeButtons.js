import {
  FaBackward,
  FaPause,
  FaPlay,
  FaStop,
} from 'react-icons/fa';
import React, { useState } from 'react';
import { datetime2time, sec2datetime, time2datetime } from 'utils/timeManipulation';
import { updateIsPlaying, updateTimePosition } from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

// transform a speed ratio (X2 X10 X20, etc.) to interval time & step to bypass
const factor2ms = (factor) => {
  const ms = Math.round(1000 / factor);
  const steps = (ms < 100) ? Math.round((1 / ms) * 100) : 1;
  return { ms, steps };
};

export default function TimeButtons() {
  const dispatch = useDispatch();
  const { timePosition, simulation, selectedTrain, stickyBar } = useSelector((state) => state.osrdsimulation);
  const [playInterval, setPlayInterval] = useState(undefined);
  const [playReverse, setPlayReverse] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);

  const stop = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    dispatch(updateTimePosition(sec2datetime(simulation.present.trains[selectedTrain].base.stops[0].time)));
    dispatch(updateIsPlaying(false));
  };
  const pause = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    dispatch(updateIsPlaying(false));
  };
  const play = (playReverseLocal, simulationSpeedLocal = simulationSpeed) => {
    clearInterval(playInterval); // Kill interval playing if concerned
    setPlayInterval(undefined);
    const factor = factor2ms(simulationSpeedLocal);
    let i = timePosition.getTime() / 1000;
    const playIntervalLocal = setInterval(() => {
      if (playReverseLocal) {
        i -= factor.steps;
      } else {
        i += factor.steps;
      }
      dispatch(updateTimePosition(new Date(i * 1000)));
    }, factor.ms);
    setPlayInterval(playIntervalLocal);
    dispatch(updateIsPlaying(true));
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
    dispatch(updateTimePosition(time2datetime(e.target.value)));
  };

  return (
    <div className="d-flex align-items-start">
      <span className="mr-1">
        <InputSNCF
          noMargin
          type="time"
          id="simulation-time"
          value={timePosition ? datetime2time(timePosition) : ''}
          onChange={changeTimePosition}
          sm
        />
      </span>
      {stickyBar && (
        <>
          <button
            type="button"
            className="btn btn-sm btn-only-icon mr-1 btn-danger"
            onClick={stop}
          >
            <FaStop />
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-only-icon mr-1 ${playReverse ? 'btn-primary' : 'btn-white'}`}
            onClick={changeReverse}
          >
            <FaBackward />
          </button>
          {playInterval ? (
            <button
              type="button"
              className="btn btn-sm btn-only-icon btn-warning mr-1"
              onClick={pause}
            >
              <FaPause />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-only-icon btn-success mr-1"
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
            sm
          />
        </>
      )}
    </div>
  );
}
