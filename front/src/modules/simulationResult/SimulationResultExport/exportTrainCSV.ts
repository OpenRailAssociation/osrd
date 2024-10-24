import type {
  ElectrificationRange,
  OperationalPointWithTimeAndSpeed,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import { convertDepartureTimeIntoSec } from 'applications/operationalStudies/utils';
import type { ReportTrain, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { PositionSpeedTime, SpeedRanges } from 'reducers/simulationResults/types';
import { timestampToHHMMSS } from 'utils/date';
import { mmToM, mToMm } from 'utils/physics';
import { ms2sec } from 'utils/timeManipulation';

import { getActualVmax, interpolateValue } from './utils';

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

// Add OPs inside speedsteps array, gather speedlimit with stop position, add electrification ranges,
// and sort the array along position before return
const overloadSteps = (
  trainRegime: ReportTrain,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  speedLimits: SpeedRanges,
  electrificationRanges: ElectrificationRange[]
): PositionSpeedTimeOP[] => {
  const speedsAtOps = operationalPoints.map((op) => ({
    position: op.position,
    speed: op.speed,
    time: op.time,
    op: op.name,
    ch: op.ch,
    lineCode: op.line_code,
    trackName: op.track_name,
  }));
  const speedsAtSpeedLimitChange = speedLimits.speeds.map((_speed, index) => {
    const boundary = index > 0 ? speedLimits.internalBoundaries[index - 1] : 0;
    return {
      position: boundary,
      speed: interpolateValue(trainRegime, mToMm(boundary), 'speeds'),
      time: interpolateValue(trainRegime, mToMm(boundary), 'times'),
    };
  });
  const speedsAtElectrificationRanges: PositionSpeedTimeOP[] = [];
  electrificationRanges.forEach((electrification, idx) => {
    const electrificationType = electrification.electrificationUsage.type;
    const electricalProfileType = electrification.electrificationUsage.electrical_profile_type;

    const electrificationMode =
      electrificationType === 'electrification' ? electrification.electrificationUsage.voltage : '';
    const electrificationProfile =
      electrificationType === 'electrification' &&
      electricalProfileType === 'profile' &&
      electrification.electrificationUsage.profile
        ? electrification.electrificationUsage.profile
        : '';
    const electrificationStart = electrification.start;

    speedsAtElectrificationRanges.push({
      position: mmToM(electrificationStart),
      speed: interpolateValue(trainRegime, electrificationStart, 'speeds'),
      electrificationType,
      electrificationMode,
      electrificationProfile,
      time: interpolateValue(trainRegime, electrificationStart, 'times'),
    });

    // ElectrificationRanges could not be continuous, so we've to handle the case of
    // empty ranges: when previousStop isn't equal to nextStart, we add a one-meter away
    // step with empty values to ensure correct spread of information along all steps
    if (
      electrificationRanges[idx + 1] &&
      electrification.stop < electrificationRanges[idx + 1].start
    ) {
      speedsAtElectrificationRanges.push({
        position: mmToM(electrification.stop + 1),
        speed: interpolateValue(trainRegime, electrification.stop + 1, 'speeds'),
        electrificationType: '',
        electrificationMode: '',
        electrificationProfile: '',
        time: interpolateValue(trainRegime, electrification.stop + 1, 'times'),
      });
    }
  });

  const formattedTrainRegime = trainRegime.speeds.map((speed, index) => ({
    speed,
    position: mmToM(trainRegime.positions[index]),
    time: trainRegime.times[index],
  }));

  const speedsWithOPsAndSpeedLimits = formattedTrainRegime.concat(
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

function createFakeLinkWithData(trainName: string, csvData: CSVData[]) {
  const currentDate = new Date();
  const header = `Date: ${currentDate.toLocaleString()}\nName: ${trainName}\nType: final_output\n`;
  const keyLine = `${Object.values(CSVKeys).join(';')}\n`;
  const csvContent = `data:text/csv;charset=utf-8,${header}\n${keyLine}${csvData.map((obj) => Object.values(obj).join(';')).join('\n')}`;
  const encodedUri = encodeURI(csvContent);
  const fakeLink = document.createElement('a');
  fakeLink.setAttribute('href', encodedUri);
  fakeLink.setAttribute('download', `export-${trainName}-final_output.csv`);
  document.body.appendChild(fakeLink);
  fakeLink.click();
  document.body.removeChild(fakeLink);
}

export default function exportTrainCSV(
  simulatedTrain: SimulationResponseSuccess,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  electrificationRanges: ElectrificationRange[],
  train: TrainScheduleBase
) {
  const trainRegimeWithAccurateTime: ReportTrain = {
    ...simulatedTrain.final_output,
    times: simulatedTrain.final_output.times.map(
      (time) => convertDepartureTimeIntoSec(train.start_time) + ms2sec(time)
    ),
  };

  const formattedMrsp: SpeedRanges = {
    internalBoundaries: simulatedTrain.mrsp.boundaries.map((d) => mmToM(d)),
    speeds: simulatedTrain.mrsp.values.map((value) => value.speed),
  };

  const speedsWithOPsAndSpeedLimits = overloadSteps(
    trainRegimeWithAccurateTime,
    operationalPoints,
    formattedMrsp,
    electrificationRanges
  );

  const steps = speedsWithOPsAndSpeedLimits.map((speed) => ({
    op: speed.op || '',
    ch: speed.ch || '',
    trackName: speed.trackName,
    time: timestampToHHMMSS(speed.time),
    seconds: pointToComma(+speed.time.toFixed(1)),
    position: pointToComma(+(speed.position / 1000).toFixed(3)),
    speed: pointToComma(+(speed.speed * 3.6).toFixed(3)),
    speedLimit: pointToComma(getActualVmax(speed.position, formattedMrsp)),
    lineCode: speed.lineCode,
    electrificationType: speed.electrificationType,
    electrificationMode: speed.electrificationMode,
    electrificationProfile: speed.electrificationProfile,
  }));
  if (steps) createFakeLinkWithData(train.train_name, spreadDataBetweenSteps(steps));
}
