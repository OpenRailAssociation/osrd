import * as d3 from 'd3';
import { PositionSpeedTime, SpeedPosition } from 'reducers/osrdsimulation/types';

export function massWithOneDecimal(number: number) {
  return Math.round(number / 100) / 10;
}

export function getTime(sec: number) {
  const timeplus = new Date(sec * 1000);
  const time = timeplus.toISOString().substr(11, 8);
  const sixthDigit = parseInt(time[6], 10);
  const seventhDigit = parseInt(time[7], 10);
  if (sixthDigit >= 0 && sixthDigit < 2) {
    if (sixthDigit === 1) {
      if (seventhDigit <= 4) {
        return time.slice(0, 5);
      }
      return `${time.slice(0, 5)}+`;
    }
    return time.slice(0, 5);
  }
  if (sixthDigit >= 1 && sixthDigit < 5) {
    if (sixthDigit === 4) {
      if (seventhDigit <= 4) {
        return `${time.slice(0, 5)}+`;
      }
      if (seventhDigit > 4) {
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

export function getActualVmax(givenPosition: number, vmax: SpeedPosition[]) {
  const vmaxPosition = d3.bisectLeft(
    vmax.map((d) => d.position),
    givenPosition
  );
  return Math.round(vmax[vmaxPosition].speed * 3.6);
}

export function getActualSpeedLeft(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition = d3.bisectLeft(
    speed.map((d) => d.position),
    givenPosition
  );
  return speed[speedPosition].speed * 3.6;
}

export function getActualPositionLeft(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition = d3.bisectLeft(
    speed.map((d) => d.position),
    givenPosition
  );
  return speed[speedPosition].position / 1000;
}

export function getActualSpeedRight(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition =
    d3.bisectLeft(
      speed.map((d) => d.position),
      givenPosition
    ) - 1;
  return speedPosition <= 0 ? speed[0].speed * 3.6 : speed[speedPosition].speed * 3.6;
}

export function getActualPositionRight(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition =
    d3.bisectLeft(
      speed.map((d) => d.position),
      givenPosition
    ) - 1;
  return speedPosition <= 0 ? speed[0].position / 1000 : speed[speedPosition].position / 1000;
}

export function getActualSpeed(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedA = getActualSpeedRight(givenPosition, speed);
  const speedB = getActualSpeedLeft(givenPosition, speed);
  const posA = getActualPositionRight(givenPosition, speed);
  const posB = getActualPositionLeft(givenPosition, speed);
  if (speedA === 0 || speedB === 0) return 0;
  const a = (speedB - speedA) / (posB - posA);
  const b = speedA - a * posA;
  return Math.round(a * (givenPosition / 1000) + b);
}

interface SpeedDistance {
  distance: number;
  speed: number;
}

export function getAverageSpeed(posA: number, posB: number, speedList: PositionSpeedTime[]) {
  let totalDistance = 0;
  const speedsAndDistances: SpeedDistance[] = [];
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
      speedsAndDistances.push({
        speed: actualPosition.speed,
        distance: actualDistance,
      } as SpeedDistance);
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
