import React from 'react';
import * as d3 from 'd3';
import nextId from 'react-id-generator';

export function massWithOneDecimal(number) {
  return Math.round(number / 100) / 10;
}

function getTime(sec) {
  const timeplus = new Date(sec * 1000);
  const time = timeplus.toISOString().substr(11, 8);
  if (time[6] >= 0 && time[6] < 2) {
    if (time[6] === '1') {
      if (time[7] <= 4) {
        return time.slice(0, 5);
      }
      return `${time.slice(0, 5)}+`;
    }
    return time.slice(0, 5);
  }
  if (time[6] >= 1 && time[6] < 5) {
    if (time[6] === '4') {
      if (time[7] <= 4) {
        return `${time.slice(0, 5)}+`;
      }
      if (time[7] > 4) {
        timeplus.setMinutes(timeplus.getMinutes() + 1);
        timeplus.setSeconds(0);
        return timeplus.toISOString().substr(11, 8).slice(0, 5);
      }
    }
    return `${time.slice(0, 5)}+`;
  }
  timeplus.setMinutes(timeplus.getMinutes() + 1);
  timeplus.setSeconds(0);
  return timeplus.toISOString().substr(11, 8).slice(0, 5);
}

function getActualVmax(givenPosition, vmax) {
  const vmaxPosition = d3.bisectLeft(
    vmax.map((d) => d.position),
    givenPosition
  );
  return Math.round(vmax[vmaxPosition].speed * 3.6);
}

function getActualSpeedLeft(givenPosition, speed) {
  const speedPosition = d3.bisectLeft(
    speed.map((d) => d.position),
    givenPosition
  );
  return speed[speedPosition].speed * 3.6;
}

function getActualPositionLeft(givenPosition, speed) {
  const speedPosition = d3.bisectLeft(
    speed.map((d) => d.position),
    givenPosition
  );
  return speed[speedPosition].position / 1000;
}

function getActualSpeedRight(givenPosition, speed) {
  const speedPosition =
    d3.bisectLeft(
      speed.map((d) => d.position),
      givenPosition
    ) - 1;
  return speedPosition <= 0 ? speed[0].speed * 3.6 : speed[speedPosition].speed * 3.6;
}

function getActualPositionRight(givenPosition, speed) {
  const speedPosition =
    d3.bisectLeft(
      speed.map((d) => d.position),
      givenPosition
    ) - 1;
  return speedPosition <= 0 ? speed[0].position / 1000 : speed[speedPosition].position / 1000;
}

function getActualSpeed(givenPosition, speed) {
  const speedA = getActualSpeedRight(givenPosition, speed);
  const speedB = getActualSpeedLeft(givenPosition, speed);
  const posA = getActualPositionRight(givenPosition, speed);
  const posB = getActualPositionLeft(givenPosition, speed);
  if (speedA === 0 || speedB === 0) return 0;
  const a = (speedB - speedA) / (posB - posA);
  const b = speedA - a * posA;
  return Math.round(a * (givenPosition / 1000) + b);
}

function getAverageSpeed(posA, posB, speedList) {
  let totalDistance = 0;
  const speedsAndDistances = [];
  let averageSpeed = 0;

  // Filter concerned speed by posA & posB (all speed sections between the two positions)
  const concernedSpeeds = speedList.filter((item) => item.position >= posA && item.position < posB);

  // When concernedSpeeds is empty or < 2, take nearest plateau speed
  if (concernedSpeeds.length === 1) return Math.round(concernedSpeeds[0].speed * 3.6 * 10) / 10;
  if (concernedSpeeds.length === 0) {
    const lastKnownSpeedPosition = d3.bisectLeft(
      speedList.map((step) => step.position),
      posB
    );
    return Math.round(speedList[lastKnownSpeedPosition].speed * 3.6 * 10) / 10;
  }

  // Get an array with speed along distance and set a sum of distance
  concernedSpeeds.forEach((actualPosition, idx) => {
    if (idx !== 0) {
      const actualDistance = actualPosition.position - speedList[idx - 1].position;
      speedsAndDistances.push({ speed: actualPosition.speed, distance: actualDistance });
      totalDistance += actualDistance;
    }
  });

  // Weight speed with distance ratio and sum it for average speed
  speedsAndDistances.forEach((step) => {
    averageSpeed += step.speed * (step.distance / totalDistance);
  });

  // Get average speed with decimal in km/h
  return Math.round(averageSpeed * 3.6 * 10) / 10;
}

export default function formatStops(stop, idx, data) {
  const actualSpeed = getActualSpeed(stop.position, data.base.speeds);
  const averageSpeed = getAverageSpeed(
    idx === 0 ? stop.position : data.base.stops[idx - 1].position,
    stop.position,
    data.base.speeds
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
      key={nextId()}
      className={`${
        stop.duration > 0 || idx === 0 || idx === data.base.stops.length - 1
          ? 'drivertrainschedule-stop'
          : ''
      }`}
    >
      <td className="text-center">
        <small>{idx + 1}</small>
      </td>
      <td className="text-center">{getActualVmax(stop.position, data.vmax)}</td>
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
              {stop.duration > 0 || idx === data.base.stops.length - 1 ? stopTime : ''}
            </div>
            <div className="box-cell px-2 px-md-0">
              {stop.duration > 0 || idx === 0 || idx === data.base.stops.length - 1 ? '' : stopTime}
            </div>
            <div className="box-cell">
              {(stop.duration > 0 && idx < data.base.stops.length - 1) || idx === 0
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
