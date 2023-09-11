import React from 'react';
import { Stop, Train } from 'reducers/osrdsimulation/types';
import {
  getActualSpeed,
  getActualVmax,
  getAverageSpeed,
  getTime,
} from './DriverTrainScheduleHelpers';

type Props = {
  stop: Stop;
  idx: number;
  train: Train;
};

export default function DriverTrainScheduleStop({ stop, idx, train }: Props) {
  const actualSpeed = getActualSpeed(stop.position, train.base.speeds);
  const averageSpeed = getAverageSpeed(
    idx === 0 ? stop.position : train.base.stops[idx - 1].position,
    stop.position,
    train.base.speeds
  );
  const pk = Math.round(stop.position / 100) / 10;
  const stopTime =
    getTime(stop.time).at(-1) === '+' ? (
      <span className="box-cell">{getTime(stop.time).slice(0, -1)}</span>
    ) : (
      getTime(stop.time)
    );
  const departureTime =
    getTime(stop.time + stop.duration).at(-1) === '+' ? (
      <span className="box-cell">{getTime(stop.time + stop.duration).slice(0, -1)}</span>
    ) : (
      getTime(stop.time + stop.duration)
    );
  return (
    <tr
      key={`drivertrainschedule-stop-${stop.position}`}
      className={`${
        stop.duration > 0 || idx === 0 || idx === train.base.stops.length - 1
          ? 'drivertrainschedule-stop'
          : ''
      }`}
    >
      <td className="text-center">
        <small>{idx + 1}</small>
      </td>
      <td className="text-center">{getActualVmax(stop.position, train.vmax)}</td>
      <td className="text-center">{actualSpeed !== 0 ? actualSpeed : null}</td>
      <td className="text-center">{averageSpeed}</td>
      <td className="d-flex justify-content-center">
        <div className="drivertrainschedule-pk">{Number.isInteger(pk) ? `${pk}.0` : pk}</div>
      </td>
      <td>{stop.name || 'Unknown'}</td>
      <td className="stoptime-container">
        <div className="box">
          <div className="box-row">
            <div className="box-cell">
              {stop.duration > 0 || idx === train.base.stops.length - 1 ? stopTime : ''}
            </div>
            <div className="box-cell px-2 px-md-0">
              {stop.duration > 0 || idx === 0 || idx === train.base.stops.length - 1
                ? ''
                : stopTime}
            </div>
            <div className="box-cell">
              {(stop.duration > 0 && idx < train.base.stops.length - 1) || idx === 0
                ? departureTime
                : ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="text-center" title={`${stop.line_name}`}>
          <small>{stop.track_name}</small>
        </div>
      </td>
    </tr>
  );
}
