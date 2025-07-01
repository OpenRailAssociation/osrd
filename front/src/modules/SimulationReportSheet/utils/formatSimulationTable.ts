import type { Style } from '@react-pdf/types';
import type { TFunction } from 'i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse, StdcmResultsOperationalPoint } from 'applications/stdcm/types';
import type {
  LightRollingStock,
  PathfindingResultSuccess,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { dateToHHMMSS } from 'utils/date';
import { addDurationToDate, Duration } from 'utils/duration';
import { kgToT } from 'utils/physics';
import { capitalizeFirstLetter } from 'utils/strings';

import { getStopDurationTime } from './formatSimulationReportSheet';
import styles from '../styles/SimulationReportStyleSheet';
import type { SimulationTableScenarioProps, SimulationTableStdcmProps } from '../types';

const getRowStyle = (
  stepDuration: Duration | null | undefined,
  isPathStep: boolean,
  isFirst: boolean,
  isLast: boolean
) => {
  const isStop = !!stepDuration && !isLast;
  const isPathStepWithoutStop = isPathStep && !isFirst && !isLast && stepDuration === null;

  let passageStopStyle: Style = styles.simulation.stopColumn;
  if (stepDuration && !isLast) {
    passageStopStyle = {
      width: `${
        stepDuration < new Duration({ seconds: 600 }) &&
        stepDuration >= new Duration({ seconds: 60 })
          ? 60
          : 70
      }px`,
      ...styles.simulation.blueStop,
    };
  } else if (isPathStepWithoutStop) {
    passageStopStyle.marginLeft = '';
  }

  return {
    rowStyle: isStop ? styles.simulation.blueRow : styles.simulation.tbody,
    stylesByColumn: {
      ...(isPathStepWithoutStop
        ? {
            index: styles.simulation.indexColumnPassageStop,
            name: styles.simulation.opColumnPassageStop,
            ch: styles.simulation.chColumnPassageStop,
            others: { ...styles.simulation.td, paddingLeft: '' },
          }
        : {
            index: styles.simulation.indexColumn,
            name: isStop ? styles.simulation.opStop : styles.simulation.td,
            ch: styles.simulation.chColumn,
            others: styles.simulation.td,
          }),
      trackName: styles.simulation.td,
      passageStop: passageStopStyle,
    },
  };
};

const formatStdcmDataForSimulationTable = (
  operationalPointsList: StdcmResultsOperationalPoint[],
  stdcmData: StdcmSuccessResponse,
  rollingStock: LightRollingStock,
  consistMass: number,
  consistLength: number,
  t: TFunction<'stdcm'>
) =>
  operationalPointsList.map((step, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousStep = operationalPointsList[index - 1];

    const isStop = step.duration !== null && !isLast;
    const isVia = stdcmData.simulationPathSteps
      .slice(1, -1)
      .some((s) => s.location!.name === step.name && s.location!.secondary_code === step.ch);
    const isPathStep = isFirst || isVia || isLast;

    const startTime = isFirst || isStop ? step.stopEndTime : '';
    const endTime = isLast || isStop ? step.time : '';
    const { stopType, trackName } = step;

    const stopTypeLabel = stopType
      ? capitalizeFirstLetter(t(`trainPath.stopType.${stopType}`))
      : t('reportSheet.serviceStop');

    let passageStop = '';
    if (!isFirst && !isLast) {
      passageStop = step.duration !== null ? getStopDurationTime(step.duration) : String(step.time);
    }

    return {
      name:
        !isPathStep && step.name === previousStep.name
          ? '='
          : step.name || t('reportSheet.unknown'),
      ch: step.ch,
      trackName,
      endTime,
      passageStop,
      startTime,
      ...(isFirst
        ? {
            weight: `${Math.floor(consistMass)} t`,
            length: `${consistLength} m`,
            referenceEngine: rollingStock.name,
          }
        : { weight: '=', length: '=', referenceEngine: '=' }),
      stopTypeLabel,
      stopType,
      ...getRowStyle(step.duration, isPathStep, isFirst, isLast),
    };
  });

const formatOperationalStudiesDataForSimulationTable = (
  operationalPointsList: OperationalPointWithTimeAndSpeed[],
  path: PathfindingResultSuccess,
  rollingStock: RollingStockWithLiveries,
  t: TFunction<'stdcm'>
) =>
  operationalPointsList.map((step, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousStep = operationalPointsList[index - 1];

    const isStop = !isFirst && !isLast && !!step.duration;
    const isVia = path.path_item_positions.slice(1, -1).some((p) => p / 1000 === step.position);
    const isPathStep = isFirst || isVia || isLast;

    const startTime =
      isFirst || isStop
        ? dateToHHMMSS(addDurationToDate(step.time, step.duration ?? Duration.zero), {
            withoutSeconds: true,
          })
        : '';
    const endTime = isLast || isStop ? dateToHHMMSS(step.time, { withoutSeconds: true }) : '';

    let passageStop = '';
    if (!isFirst && !isLast) {
      // display the stop duration if is a stop, the passage time if not
      passageStop = step.duration
        ? getStopDurationTime(step.duration)
        : dateToHHMMSS(step.time, { withoutSeconds: true });
    }

    return {
      name:
        !isPathStep && step.name === previousStep.name
          ? '='
          : step.name || t('reportSheet.unknown'),
      ch: step.ch,
      trackName: step.track_name || '-',
      endTime,
      passageStop,
      startTime,
      ...(isFirst
        ? {
            weight: `${Math.floor(kgToT(rollingStock.mass))} t`,
            length: '=',
            referenceEngine: rollingStock.name,
          }
        : { weight: '=', length: '=', referenceEngine: '=' }),
      ...getRowStyle(step.duration, isPathStep, isFirst, isLast),
    };
  });

type SimulationTableRow = {
  name: string;
  ch?: string | null;
  trackName?: string;
  endTime: string | Date | null;
  passageStop: string | Date | null;
  startTime: string | Date | null;
  weight: string;
  length: string;
  referenceEngine: string;
  stopTypeLabel?: string;
  stopType?: string;
  rowStyle: Style;
  stylesByColumn: {
    index: Style;
    name: Style;
    ch: Style;
    trackName?: Style;
    passageStop: Style;
    others: Style;
  };
};

type FormatSimulationTableProps =
  | (SimulationTableStdcmProps & { mode: 'stdcm' })
  | (SimulationTableScenarioProps & { mode: 'operationalStudies' });

const formatSimulationTable = (
  options: FormatSimulationTableProps,
  t: TFunction<'stdcm'>
): SimulationTableRow[] => {
  if (options.mode === 'stdcm') {
    return formatStdcmDataForSimulationTable(
      options.operationalPointsList,
      options.stdcmData,
      options.rollingStock,
      options.consistMass,
      options.consistLength,
      t
    );
  }
  return formatOperationalStudiesDataForSimulationTable(
    options.operationalPointsList,
    options.path,
    options.rollingStock,
    t
  );
};

export default formatSimulationTable;
