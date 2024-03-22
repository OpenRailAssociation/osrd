import * as d3 from 'd3';

import type {
  PositionSpeedTime,
  Regime,
  SpeedPosition,
  Train,
} from 'reducers/osrdsimulation/types';
import { timestampToHHMMSS } from 'utils/date';

import type { BaseOrEcoType } from './DriverTrainScheduleTypes';

/**
 * CSV Export of trainschedule
 *
 * Rows : position in km, speed in km/h, speed limit in km/h, time in s
 *
 */

enum CSVKeys {
  op = 'op',
  ch = 'ch',
  lineCode = 'lineCode',
  trackName = 'trackName',
  position = 'position',
  speed = 'speed',
  speedLimit = 'speedLimit',
  seconds = 'seconds',
  time = 'time',
}

type CSVData = {
  [key in keyof typeof CSVKeys]: string;
};

type PositionSpeedTimeOP = PositionSpeedTime & {
  speedLimit?: number;
  op?: '';
  ch?: '';
  lineCode?: '';
  trackName?: '';
};

const pointToComma = (number: number) => number.toString().replace('.', ',');

const interpolateValue = (
  position: number,
  speeds: PositionSpeedTime[],
  value: 'speed' | 'time'
): number => {
  const bisector = d3.bisectLeft(
    speeds.map((d: SpeedPosition) => d.position),
    position
  );

  if (bisector === 0) return speeds[bisector][value];

  const leftSpeed = speeds[bisector - 1];
  const rightSpeed = speeds[bisector];

  const totalDistance = rightSpeed.position - leftSpeed.position;
  const distance = position - leftSpeed.position;
  const totalDifference = rightSpeed[value] - leftSpeed[value];
  return leftSpeed[value] + (totalDifference * distance) / totalDistance;
};

const getStepSpeedLimit = (position: number, speedLimitList: Train['vmax']) => {
  const bisector = d3.bisectLeft(
    speedLimitList.map((d: SpeedPosition) => d.position),
    position
  );
  return speedLimitList[bisector].speed || 0;
};

// Add OPs inside speedsteps array, gather speedlimit with stop position, and sort the array along position before return
const overloadWithOPsAndSpeedLimits = (
  trainRegime: Regime,
  speedLimits: SpeedPosition[]
): PositionSpeedTimeOP[] => {
  const speedsAtOps = trainRegime.stops.map((stop) => ({
    position: stop.position,
    speed: interpolateValue(stop.position, trainRegime.speeds, 'speed'),
    time: stop.time,
    op: stop.name,
    ch: stop.ch,
    lineCode: stop.line_code,
    trackName: stop.track_name,
  }));
  const speedsAtSpeedLimitChange = speedLimits.map((speedLimit) => ({
    position: speedLimit.position,
    speed: interpolateValue(speedLimit.position, trainRegime.speeds, 'speed'),
    speedLimit: speedLimit.speed,
    time: interpolateValue(speedLimit.position, trainRegime.speeds, 'time'),
  }));

  const speedsWithOPsAndSpeedLimits = trainRegime.speeds.concat(
    speedsAtOps,
    speedsAtSpeedLimitChange
  );

  return speedsWithOPsAndSpeedLimits.sort((stepA, stepB) => stepA.position - stepB.position);
};

function spreadTrackAndLineNames(steps: CSVData[]): CSVData[] {
  let oldTrackName = '';
  let oldLineCode = '';
  const newSteps: CSVData[] = [];
  steps.forEach((step) => {
    const newTrackName =
      oldTrackName !== '' && step.trackName === '' ? oldTrackName : step.trackName;
    const newLineCode = oldLineCode !== '' && step.lineCode === '' ? oldLineCode : step.lineCode;
    newSteps.push({
      ...step,
      trackName: newTrackName,
      lineCode: newLineCode,
    });
    oldTrackName = newTrackName;
    oldLineCode = newLineCode;
  });
  return newSteps;
}

function createFakeLinkWithData(train: Train, baseOrEco: BaseOrEcoType, csvData: CSVData[]) {
  const currentDate = new Date();
  const header = `Date: ${currentDate.toLocaleString()}\nName: ${train.name}\nType:${baseOrEco}\n`;
  const keyLine = `${Object.values(CSVKeys).join(';')}\n`;
  const csvContent = `data:text/csv;charset=utf-8,${header}\n${keyLine}${csvData.map((obj) => Object.values(obj).join(';')).join('\n')}`;
  const encodedUri = encodeURI(csvContent);
  const fakeLink = document.createElement('a');
  fakeLink.setAttribute('href', encodedUri);
  fakeLink.setAttribute('download', `export-${train.name}-${baseOrEco}.csv`);
  document.body.appendChild(fakeLink);
  fakeLink.click();
  document.body.removeChild(fakeLink);
}

export default function driverTrainScheduleExportCSV(train: Train, baseOrEco: BaseOrEcoType) {
  const trainRegime = train[baseOrEco];
  if (trainRegime) {
    const speedsWithOPsAndSpeedLimits = overloadWithOPsAndSpeedLimits(trainRegime, train.vmax);
    const steps = speedsWithOPsAndSpeedLimits.map((speed) => ({
      op: speed.op || '',
      ch: speed.ch || '',
      lineCode: speed.lineCode || '',
      trackName: speed.trackName || '',
      position: pointToComma(+(speed.position / 1000).toFixed(3)),
      speed: pointToComma(+(speed.speed * 3.6).toFixed(3)),
      speedLimit: pointToComma(
        Math.round((speed.speedLimit ?? getStepSpeedLimit(speed.position, train.vmax)) * 3.6)
      ),
      seconds: pointToComma(+speed.time.toFixed(1)),
      time: timestampToHHMMSS(speed.time),
    }));
    if (steps) createFakeLinkWithData(train, baseOrEco, spreadTrackAndLineNames(steps));
  }
}
