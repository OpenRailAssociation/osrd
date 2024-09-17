import { useMemo } from 'react';

import cx from 'classnames';

import type { PositionSpeedTime, SpeedRanges } from 'reducers/simulationResults/types';

import type { OperationalPointWithTimeAndSpeed } from './types';
import { getActualSpeed, getActualVmax, getAverageSpeed, getTime } from './utils';

type DriverTrainScheduleStopProps = {
  operationalPoint: OperationalPointWithTimeAndSpeed;
  operationalPoints: OperationalPointWithTimeAndSpeed[];
  idx: number;
  trainRegimeReports: PositionSpeedTime[];
  speedLimits: SpeedRanges;
};

const DriverTrainScheduleStop = ({
  operationalPoint,
  operationalPoints,
  idx,
  trainRegimeReports,
  speedLimits,
}: DriverTrainScheduleStopProps) => {
  const actualSpeed = useMemo(
    () => getActualSpeed(operationalPoint.position, trainRegimeReports),
    [operationalPoint.position]
  );

  const averageSpeed = useMemo(
    () =>
      getAverageSpeed(
        idx === 0 ? operationalPoint.position : operationalPoints[idx - 1].position,
        operationalPoint.position,
        trainRegimeReports
      ),
    [trainRegimeReports]
  );
  const pk = Math.round(operationalPoint.position / 100) / 10;

  let stopTime;
  let departureTime;
  if (!Number.isNaN(operationalPoint.time)) {
    stopTime =
      getTime(operationalPoint.time).at(-1) === '+' ? (
        <span className="box-cell">{getTime(operationalPoint.time).slice(0, -1)}</span>
      ) : (
        getTime(operationalPoint.time)
      );

    if (!Number.isNaN(operationalPoint.duration)) {
      departureTime =
        getTime(operationalPoint.time + operationalPoint.duration).at(-1) === '+' ? (
          <span className="box-cell">
            {getTime(operationalPoint.time + operationalPoint.duration).slice(0, -1)}
          </span>
        ) : (
          getTime(operationalPoint.time + operationalPoint.duration)
        );
    }
  }

  return (
    <tr
      key={`drivertrainschedule-stop-${operationalPoint.position}`}
      className={cx({
        'drivertrainschedule-stop':
          operationalPoint.duration > 0 || idx === 0 || idx === operationalPoints.length - 1,
      })}
    >
      <td className="text-center">
        <small>{idx + 1}</small>
      </td>
      <td className="text-center">{getActualVmax(operationalPoint.position, speedLimits)}</td>
      <td className="text-center">{actualSpeed !== 0 ? actualSpeed : null}</td>
      <td className="text-center">{averageSpeed}</td>
      <td className="d-flex justify-content-center">
        <div>{Number.isInteger(pk) ? `${pk}.0` : pk}</div>
      </td>
      <td>
        {operationalPoint.name || 'Unknown'}&nbsp;
        <small>{operationalPoint.ch}</small>
      </td>
      <td className="stoptime-container">
        <div className="box">
          <div className="box-row">
            <div className="box-cell">
              {operationalPoint.duration > 0 || idx === operationalPoints.length - 1
                ? stopTime
                : ''}
            </div>
            <div className="box-cell px-2 px-md-0">
              {operationalPoint.duration > 0 || idx === 0 || idx === operationalPoints.length - 1
                ? ''
                : stopTime}
            </div>
            <div className="box-cell">
              {(operationalPoint.duration > 0 && idx < operationalPoints.length - 1) || idx === 0
                ? departureTime
                : ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="text-center" title={`${operationalPoint.line_name}`}>
          <small>{operationalPoint.track_name}</small>
        </div>
      </td>
    </tr>
  );
};

export default DriverTrainScheduleStop;
