import * as d3 from 'd3';

import type { ElectrificationRange } from 'common/api/osrdEditoastApi';
import type {
  PositionSpeedTime,
  Regime,
  SpeedPosition,
  Train,
} from 'reducers/osrdsimulation/types';
import { timestampToHHMMSS } from 'utils/date';

import type { BaseOrEcoType } from './consts';

/**
 * CSV Export of trainschedule
 *
 * Rows : position in km, speed in km/h, speed limit in km/h, time in s
 *
 */

enum CSVKeys {
  op = 'op',
  ch = 'ch',
  trackName = 'trackName',
  time = 'time',
  seconds = 'seconds',
  position = 'position',
  speed = 'speed',
  speedLimit = 'speedLimit',
  lineCode = 'lineCode',
  electrificationType = 'electrificationType',
  electrificationMode = 'electrificationMode',
  electrificationProfile = 'electrificationProfile',
}

type CSVData = {
  [key in keyof typeof CSVKeys]?: string;
};

type PositionSpeedTimeOP = PositionSpeedTime & {
  speedLimit?: number;
  op?: string;
  ch?: string;
  lineCode?: string;
  trackName?: string;
  electrificationType?: string;
  electrificationMode?: string;
  electrificationProfile?: string;
};

const pointToComma = (number: number) => number.toString().replace('.', ',');
const compareOldActualValues = (old?: string, actual?: string) =>
  old !== undefined && actual === undefined ? old : actual;

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

// Add OPs inside speedsteps array, gather speedlimit with stop position, add electrification ranges,
// and sort the array along position before return
const overloadSteps = (
  trainRegime: Regime,
  speedLimits: SpeedPosition[],
  electrificationRanges: ElectrificationRange[]
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
  const speedsAtElectrificationRanges: PositionSpeedTimeOP[] = [];
  electrificationRanges.forEach((electrification, idx) => {
    const electrificationType = electrification.electrificationUsage.object_type;
    const electrificationMode =
      electrificationType === 'Electrified' ? electrification.electrificationUsage.mode : '';
    const electrificationProfile =
      electrificationType === 'Electrified' && electrification.electrificationUsage.profile
        ? electrification.electrificationUsage.profile
        : '';
    const electrificationStart = electrification.start;

    speedsAtElectrificationRanges.push({
      position: electrificationStart,
      speed: interpolateValue(electrificationStart, trainRegime.speeds, 'speed'),
      electrificationType,
      electrificationMode,
      electrificationProfile,
      time: interpolateValue(electrificationStart, trainRegime.speeds, 'time'),
    });

    // ElectrificationRanges could not be continuous, so we've to handle the case of
    // empty ranges: when previousStop isn't equal to nextStart, we add a one-meter away
    // step with empty values to ensure correct spread of information along all steps
    if (
      electrificationRanges[idx + 1] &&
      electrification.stop < electrificationRanges[idx + 1].start
    ) {
      speedsAtElectrificationRanges.push({
        position: electrification.stop + 1,
        speed: interpolateValue(electrification.stop + 1, trainRegime.speeds, 'speed'),
        electrificationType: '',
        electrificationMode: '',
        electrificationProfile: '',
        time: interpolateValue(electrification.stop + 1, trainRegime.speeds, 'time'),
      });
    }
  });

  const speedsWithOPsAndSpeedLimits = trainRegime.speeds.concat(
    speedsAtOps,
    speedsAtSpeedLimitChange,
    speedsAtElectrificationRanges
  );

  return speedsWithOPsAndSpeedLimits.sort((stepA, stepB) => stepA.position - stepB.position);
};

// Complete empty cells of data between steps for specific columns
function spreadDataBetweenSteps(steps: CSVData[]): CSVData[] {
  let oldTrackName: string | undefined;
  let oldLineCode: string | undefined;
  let oldElectrificationType: string | undefined;
  let odlElectrificationMode: string | undefined;
  let oldElectrificationProfile: string | undefined;
  const newSteps: CSVData[] = [];
  steps.forEach((step) => {
    const newTrackName = compareOldActualValues(oldTrackName, step.trackName);
    const newLineCode = compareOldActualValues(oldLineCode, step.lineCode);
    const newElectrificationType = compareOldActualValues(
      oldElectrificationType,
      step.electrificationType
    );
    const newElectrificationMode = compareOldActualValues(
      odlElectrificationMode,
      step.electrificationMode
    );
    const newElectrificationProfile = compareOldActualValues(
      oldElectrificationProfile,
      step.electrificationProfile
    );
    newSteps.push({
      ...step,
      trackName: newTrackName,
      lineCode: newLineCode,
      electrificationType: newElectrificationType,
      electrificationMode: newElectrificationMode,
      electrificationProfile: newElectrificationProfile,
    });
    oldTrackName = newTrackName;
    oldLineCode = newLineCode;
    oldElectrificationType = newElectrificationType;
    odlElectrificationMode = newElectrificationMode;
    oldElectrificationProfile = newElectrificationProfile;
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
    const speedsWithOPsAndSpeedLimits = overloadSteps(
      trainRegime,
      train.vmax,
      train.electrification_ranges
    );
    const steps = speedsWithOPsAndSpeedLimits.map((speed) => ({
      op: speed.op || '',
      ch: speed.ch || '',
      trackName: speed.trackName,
      time: timestampToHHMMSS(speed.time),
      seconds: pointToComma(+speed.time.toFixed(1)),
      position: pointToComma(+(speed.position / 1000).toFixed(3)),
      speed: pointToComma(+(speed.speed * 3.6).toFixed(3)),
      speedLimit: pointToComma(
        Math.round((speed.speedLimit ?? getStepSpeedLimit(speed.position, train.vmax)) * 3.6)
      ),
      lineCode: speed.lineCode,
      electrificationType: speed.electrificationType,
      electrificationMode: speed.electrificationMode,
      electrificationProfile: speed.electrificationProfile,
    }));
    if (steps) createFakeLinkWithData(train, baseOrEco, spreadDataBetweenSteps(steps));
  }
}
