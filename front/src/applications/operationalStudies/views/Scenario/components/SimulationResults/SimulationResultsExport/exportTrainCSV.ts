import type {
  OperationalPointWithTimeAndSpeed,
  ElectrificationRange,
} from 'applications/operationalStudies/types';
import type {
  CoreReportTrain,
  CoreSpeedLimitProperties,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import { interpolateValue } from 'modules/simulationResult/helpers/utils';
import type { Train } from 'reducers/osrdconf/types';
import { formatLocalTime } from 'utils/date';
import { mToMm, mmToKm, msToKmh, msToKmhRounded, msToS } from 'utils/physics';

type KinematicInfo = { time: number; speed: number };

type OpInfo = Pick<
  OperationalPointWithTimeAndSpeed,
  'name' | 'secondary_code' | 'line_code' | 'track_name'
>;

type ElectrificationInfo = {
  electrificationType: string;
  electrificationMode: string;
  electrificationProfile: string;
};

type StepInfo = {
  speedLimit?: number;
  electrification?: ElectrificationInfo;
  kinematics: KinematicInfo[];
  op?: OpInfo;
};

const CSV_KEYS = [
  'op',
  'secondaryCode',
  'trackName',
  'lineCode',
  'position',
  'time',
  'seconds',
  'speed',
  'speedLimit',
  'electrificationType',
  'electrificationMode',
  'electrificationProfile',
] as const;

type CSVLine = Record<(typeof CSV_KEYS)[number], string>;

/**
 * Build a dictionary associating each position with the speed(s) and time(s) at the position (multiple for a stop),
 * as well as with any present op or change in speed limit or electrification
 */
function buildStepInfoByPosition(
  trainRegime: CoreReportTrain,
  trainStartTime: number,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  speedLimits: CoreSpeedLimitProperties,
  electrificationRanges: ElectrificationRange[]
): Record<number, StepInfo> {
  const stepInfoByPosition: Record<number, StepInfo> = {};

  trainRegime.positions.forEach((pos, i) => {
    stepInfoByPosition[pos] ??= { kinematics: [] };
    stepInfoByPosition[pos].kinematics.push({
      speed: trainRegime.speeds[i],
      time: trainStartTime + trainRegime.times[i],
    });
  });

  operationalPoints.forEach((op) => {
    const pos = Math.round(mToMm(op.position));
    stepInfoByPosition[pos] ??= { kinematics: [] };
    stepInfoByPosition[pos].kinematics.push({
      speed: op.speed,
      time: op.time.getTime(),
    });
    stepInfoByPosition[pos].op = op;
  });

  speedLimits.values.forEach((speedLimit, i) => {
    const pos = i === 0 ? 0 : Math.round(speedLimits.boundaries[i - 1]);
    stepInfoByPosition[pos] ??= { kinematics: [] };
    stepInfoByPosition[pos].speedLimit = speedLimit.speed;
  });

  electrificationRanges.forEach((electrification) => {
    const electrificationType = electrification.electrificationUsage.type;
    const electricalProfileType = electrification.electrificationUsage.electrical_profile_type;
    const electrificationMode =
      electrificationType === 'electrification' ? electrification.electrificationUsage.voltage : '';
    const electrificationProfile =
      electrificationType === 'electrification' && electricalProfileType === 'profile'
        ? (electrification.electrificationUsage.profile ?? '')
        : '';

    const pos = Math.round(mToMm(electrification.start));
    stepInfoByPosition[pos] ??= { kinematics: [] };
    stepInfoByPosition[pos].electrification = {
      electrificationType,
      electrificationMode,
      electrificationProfile,
    };
  });

  return stepInfoByPosition;
}

const pointToComma = (number: number) => number.toString().replace('.', ',');

/**
 * For each position in the keys of stepInfoByPosition in order, build either one or 2 csv lines.
 * 2 csv lines are built if the step is a stop or if it corresponds to a boundary in speed limit or electrification.
 * If for a position no kinematic information is present, we interpolate it from the existing kinematics in the trainRegime.
 */
function buildCsvLines(
  stepInfoByPosition: Record<number, StepInfo>,
  trainRegime: CoreReportTrain,
  trainStartTime: number
) {
  let curSpeedLimit = stepInfoByPosition[0].speedLimit
    ? pointToComma(msToKmhRounded(stepInfoByPosition[0].speedLimit))
    : '';
  let curElectrification = stepInfoByPosition[0].electrification ?? {
    electrificationType: '',
    electrificationMode: '',
    electrificationProfile: '',
  };
  const csvLines: CSVLine[] = [];

  Object.entries(stepInfoByPosition)
    .sort(([pos1, _step1], [pos2, _step2]) => Number(pos1) - Number(pos2))
    .forEach(([rawPos, step]) => {
      const position = Number(rawPos);
      let kinematics = step.kinematics;
      kinematics.sort((step1, step2) => step1.time - step2.time);
      if (step.kinematics.length === 0) {
        kinematics = [
          {
            speed: interpolateValue(trainRegime, position, 'speeds'),
            time: trainStartTime + interpolateValue(trainRegime, position, 'times'),
          },
        ];
      }

      const csvLine = {
        op: step.op?.name ?? '',
        secondaryCode: step.op?.secondary_code ?? '',
        trackName: step.op?.track_name ?? '',
        lineCode: String(step.op?.line_code ?? ''),
        position: pointToComma(+mmToKm(position).toFixed(3)),
        time: formatLocalTime(new Date(kinematics[0].time)),
        seconds: pointToComma(+msToS(kinematics[0].time).toFixed(1)),
        speed: pointToComma(+msToKmh(kinematics[0].speed).toFixed(3)),
        speedLimit: curSpeedLimit,
        electrificationType: curElectrification.electrificationType,
        electrificationMode: curElectrification.electrificationMode,
        electrificationProfile: curElectrification.electrificationProfile,
      };
      csvLines.push(csvLine);

      const isStop =
        kinematics.length >= 2 && kinematics[0].time !== kinematics[kinematics.length - 1].time;
      const isBoundary = position !== 0 && (step.speedLimit || step.electrification);
      if (isStop || isBoundary) {
        curSpeedLimit = step.speedLimit
          ? pointToComma(msToKmhRounded(step.speedLimit))
          : curSpeedLimit;
        curElectrification = step.electrification ?? curElectrification;
        const finalKinematics = kinematics[kinematics.length - 1];
        csvLines.push({
          ...csvLine,
          time: formatLocalTime(new Date(finalKinematics.time)),
          seconds: pointToComma(+msToS(finalKinematics.time).toFixed(1)),
          speed: pointToComma(+msToKmh(finalKinematics.speed).toFixed(3)),
          speedLimit: curSpeedLimit,
          electrificationType: curElectrification.electrificationType,
          electrificationMode: curElectrification.electrificationMode,
          electrificationProfile: curElectrification.electrificationProfile,
        });
      }
    });
  return csvLines;
}

/** Format the given lines as a csv file and download it by clicking a temporary link */
function downloadCsv(trainName: string, csvLines: CSVLine[]) {
  const currentDate = new Date();
  const header = `Date: ${currentDate.toLocaleString()}\nName: ${trainName}\nType: final_output\n`;
  const keyLine = `${CSV_KEYS.join(';')}\n`;
  const csvContent = `data:text/csv;charset=utf-8,${header}\n${keyLine}${csvLines.map((line) => CSV_KEYS.map((key) => line[key]).join(';')).join('\n')}\n`;
  const encodedUri = encodeURI(csvContent);
  const fakeLink = document.createElement('a');
  fakeLink.setAttribute('href', encodedUri);
  fakeLink.setAttribute('download', `export-${trainName}-final_output.csv`);
  document.body.appendChild(fakeLink);
  fakeLink.click();
  document.body.removeChild(fakeLink);
}

/** Export the train simulation as a csv */
export default function exportTrainCSV(
  simulatedTrain: SimulationResponseSuccess,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  electrificationRanges: ElectrificationRange[],
  train: Train
) {
  const trainRegime = simulatedTrain.final_output;
  const stepInfoByPosition = buildStepInfoByPosition(
    trainRegime,
    train.start_time,
    operationalPoints,
    simulatedTrain.mrsp,
    electrificationRanges
  );
  const csvLines = buildCsvLines(stepInfoByPosition, trainRegime, train.start_time);
  downloadCsv(train.train_name, csvLines);
}
