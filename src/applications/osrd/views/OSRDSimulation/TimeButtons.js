import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  FaStop, FaPause, FaPlay, FaBackward,
} from 'react-icons/fa';

const SIMULATION_SPEED = 25; // ratio factor

// transform a speed ratio (X2 X10 X20, etc.) to interval time & step to bypass
const factor2ms = (factor) => {
  const ms = Math.round(1000 / factor);
  const steps = (ms < 100) ? Math.round((1 / ms) * 100) : 1;
  return { ms, steps };
};

export default function TimeButtons(props) {
  const { setHoverPosition, simulationLength } = props;
  const [playInterval, setPlayInterval] = useState(undefined);
  const [playState, setPlayState] = useState(0);
  const [playReverse, setPlayReverse] = useState(false);

  const stop = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    setPlayState(0);
    setHoverPosition(0);
  };
  const pause = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
  };
  const play = () => {
    clearInterval(playInterval); // Kill interval playing if concerned
    setPlayInterval(undefined);
    const factor = factor2ms(SIMULATION_SPEED);
    let i = (playReverse && playState === 0) ? simulationLength : playState;
    const playIntervalLocal = setInterval(() => {
      setHoverPosition(i);
      if (playReverse) {
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
      play();
    }
  };

  return (
    <>
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
          className="btn btn-only-icon btn-success"
          onClick={play}
        >
          <FaPlay />
        </button>
      )}
    </>
  );
}

TimeButtons.propTypes = {
  setHoverPosition: PropTypes.func.isRequired,
  simulationLength: PropTypes.number.isRequired,
};
