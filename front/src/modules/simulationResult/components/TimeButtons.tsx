import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { FaBackward, FaPause, FaPlay, FaStop } from 'react-icons/fa';

import { convertDepartureTimeIntoSec } from 'applications/operationalStudies/utils';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { updateIsPlaying } from 'reducers/osrdsimulation/actions';
import { useAppDispatch } from 'store';
import { datetime2time, sec2datetime, time2datetime } from 'utils/timeManipulation';

import { useChartSynchronizerV2 } from './ChartSynchronizer';

// transform a speed ratio (X2 X10 X20, etc.) to interval time & step to bypass
const factor2ms = (factor: number) => {
  const ms = Math.round(1000 / factor);
  const steps = ms < 100 ? Math.round((1 / ms) * 100) : 1;
  return { ms, steps };
};

type TimeButtonsProps = {
  departureTime?: string;
};

const TimeButtons = ({ departureTime }: TimeButtonsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('simulation');

  const [playInterval, setPlayInterval] = useState<NodeJS.Timeout | undefined>(undefined);
  const [playReverse, setPlayReverse] = useState(false);

  const [simulationSpeed, setSimulationSpeed] = useState<number | null>(1);

  const [localTimePosition, setLocalTimePosition] = useState<Date>(new Date());

  const { updateTimePosition: updateTimePositionV2 } = useChartSynchronizerV2(
    (timePosition) => {
      setLocalTimePosition(timePosition);
    },
    'time-buttons',
    []
  );

  const stop = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    if (departureTime)
      updateTimePositionV2(sec2datetime(convertDepartureTimeIntoSec(departureTime)));

    dispatch(updateIsPlaying(false));
  };

  const pause = () => {
    clearInterval(playInterval);
    setPlayInterval(undefined);
    dispatch(updateIsPlaying(false));
  };

  const play = (playReverseLocal: boolean, simulationSpeedLocal = simulationSpeed ?? 1) => {
    clearInterval(playInterval); // Kill interval playing if concerned
    setPlayInterval(undefined);
    const factor = factor2ms(simulationSpeedLocal);
    let i = localTimePosition.getTime() / 1000;
    const playIntervalLocal = setInterval(() => {
      if (playReverseLocal) {
        i -= factor.steps;
      } else {
        i += factor.steps;
      }
      updateTimePositionV2(new Date(i * 1000));
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

  const changeSimulationSpeed = (value: string) => {
    const numberValue = value === '' ? null : Number(value);

    if (value.charAt(0) === '0') {
      setSimulationSpeed(null);
      return;
    }

    if (numberValue && numberValue < 0) {
      return;
    }

    setSimulationSpeed(numberValue);
    if (playInterval) {
      play(playReverse, numberValue ?? 1);
    }
  };

  const changeTimePosition = (newTimePosition: string) => {
    const newTimePositionDate = time2datetime(newTimePosition);
    if (newTimePositionDate) {
      updateTimePositionV2(newTimePositionDate);
    }
  };

  return (
    <div className="d-flex align-items-start">
      <span className="mr-2">
        <InputSNCF
          noMargin
          type="time"
          id="simulation-time"
          value={datetime2time(localTimePosition)}
          onChange={(e) => changeTimePosition(e.target.value)}
          sm
        />
      </span>
      <button
        type="button"
        className="btn btn-sm btn-only-icon mr-2 btn-danger"
        aria-label={t('resetTimer')}
        title={t('resetTimer')}
        onClick={stop}
      >
        <FaStop />
      </button>
      <button
        type="button"
        className={`btn btn-sm btn-only-icon mr-2 ${playReverse ? 'btn-primary' : 'btn-white'}`}
        aria-label={t('toggleRewind')}
        title={t('toggleRewind')}
        onClick={changeReverse}
      >
        <FaBackward />
      </button>
      {playInterval ? (
        <button
          type="button"
          className="btn btn-sm btn-only-icon btn-warning mr-2"
          aria-label={t('playSimulation')}
          title={t('playSimulation')}
          onClick={pause}
        >
          <FaPause />
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-only-icon btn-success mr-2"
          aria-label={t('pauseSimulation')}
          title={t('pauseSimulation')}
          onClick={() => play(playReverse)}
        >
          <FaPlay />
        </button>
      )}
      <InputSNCF
        noMargin
        type="number"
        min={1}
        id="simulation-speed"
        value={simulationSpeed ?? ''}
        onChange={(e) => changeSimulationSpeed(e.target.value)}
        sm
      />
    </div>
  );
};

export default TimeButtons;
