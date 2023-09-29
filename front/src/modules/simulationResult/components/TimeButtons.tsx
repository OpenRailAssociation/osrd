import { FaBackward, FaPause, FaPlay, FaStop } from 'react-icons/fa';
import React, { useState } from 'react';
import { datetime2time, sec2datetime, time2datetime } from 'utils/timeManipulation';
import { useDispatch } from 'react-redux';
import { updateIsPlaying, updateTimePositionValues } from 'reducers/osrdsimulation/actions';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { SimulationReport } from 'common/api/osrdEditoastApi';

// transform a speed ratio (X2 X10 X20, etc.) to interval time & step to bypass
const factor2ms = (factor: number) => {
  const ms = Math.round(1000 / factor);
  const steps = ms < 100 ? Math.round((1 / ms) * 100) : 1;
  return { ms, steps };
};

type TimeButtonsProps = {
  selectedTrain: SimulationReport;
  timePosition: Date;
};

const TimeButtons = ({ selectedTrain, timePosition }: TimeButtonsProps) => {
  const dispatch = useDispatch();

  const [playInterval, setPlayInterval] = useState<NodeJS.Timer | undefined>(undefined);
  const [playReverse, setPlayReverse] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);

  const stop = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    if (selectedTrain) {
      const finalDate = sec2datetime(selectedTrain.base.stops[0].time);
      dispatch(updateTimePositionValues(finalDate));
    }
    dispatch(updateIsPlaying(false));
  };

  const pause = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    dispatch(updateIsPlaying(false));
  };

  const play = (playReverseLocal: boolean, simulationSpeedLocal = simulationSpeed) => {
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
      dispatch(updateTimePositionValues(new Date(i * 1000)));
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

  const changeSimulationSpeed = (speedFactor: number) => {
    setSimulationSpeed(speedFactor);
    if (playInterval) {
      play(playReverse, speedFactor);
    }
  };

  const changeTimePosition = (newTimePosition: string) => {
    const newTimePositionDate = time2datetime(newTimePosition);
    if (newTimePositionDate) {
      dispatch(updateTimePositionValues(newTimePositionDate));
    }
  };

  return (
    <div className="d-flex align-items-start">
      <span className="mr-2">
        <InputSNCF
          noMargin
          type="time"
          id="simulation-time"
          value={datetime2time(timePosition)}
          onChange={(e) => changeTimePosition(e.target.value)}
          sm
        />
      </span>
      <button type="button" className="btn btn-sm btn-only-icon mr-2 btn-danger" onClick={stop}>
        <FaStop />
      </button>
      <button
        type="button"
        className={`btn btn-sm btn-only-icon mr-2 ${playReverse ? 'btn-primary' : 'btn-white'}`}
        onClick={changeReverse}
      >
        <FaBackward />
      </button>
      {playInterval ? (
        <button type="button" className="btn btn-sm btn-only-icon btn-warning mr-2" onClick={pause}>
          <FaPause />
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-only-icon btn-success mr-2"
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
        onChange={(e) => changeSimulationSpeed(Number(e.target.value))}
        sm
      />
    </div>
  );
};

export default TimeButtons;
