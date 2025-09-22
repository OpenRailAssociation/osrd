import type { Style } from '@react-pdf/types';
import type { TFunction } from 'i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse, StdcmResultsOperationalPoint } from 'applications/stdcm/types';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { addDurationToDate, Duration } from 'utils/duration';
import { kgToT } from 'utils/physics';
import { capitalizeFirstLetter } from 'utils/strings';

import { getStopDurationTime } from './formatSimulationReportSheet';
import styles from '../styles/SimulationReportStyleSheet';

const getRowStyle = (
  stepDuration: Duration | null | undefined,
  isPathStep: boolean,
  isFirst: boolean,
  isLast: boolean
) => {
  const isStop = !!stepDuration && !isLast;
  const isPathStepWithoutStop = isPathStep && !isFirst && !isLast && stepDuration === null;

  let passageStopStyle: Style = { ...styles.simulation.stopColumn };
  if (stepDuration && !isLast) {
    let width = 60;
    if (stepDuration >= new Duration({ seconds: 60000 })) width = 90;
    else if (stepDuration >= new Duration({ seconds: 6000 })) width = 80;
    else if (stepDuration >= new Duration({ seconds: 600 })) width = 70;
    else if (stepDuration < new Duration({ seconds: 60 })) width = 70;
    passageStopStyle = {
      width: `${width}px`,
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

export const formatStdcmDataForSimulationTable = (
  operationalPointsList: StdcmResultsOperationalPoint[],
  stdcmPathSteps: StdcmSuccessResponse['simulationPathSteps'],
  consist: { mass: number; length: number; rollingStockName: string },
  t: TFunction<'stdcm'>
) =>
  operationalPointsList.map((step, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousStep = operationalPointsList[index - 1];

    const isStop = step.duration !== null && !isLast;
    const isVia = stdcmPathSteps
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
            weight: `${Math.floor(consist.mass)} t`,
            length: `${consist.length} m`,
            referenceEngine: consist.rollingStockName,
          }
        : { weight: '=', length: '=', referenceEngine: '=' }),
      stopTypeLabel,
      stopType,
      ...getRowStyle(step.duration, isPathStep, isFirst, isLast),
    };
  });

export const formatOperationalStudiesDataForSimulationTable = (
  operationalPointsList: OperationalPointWithTimeAndSpeed[],
  pathItemPositions: PathfindingResultSuccess['path_item_positions'],
  rollingStock: { mass: number; name: string },
  t: TFunction<'stdcm'>,
  dateTimeLocale: Intl.Locale
) =>
  operationalPointsList.map((step, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousStep = operationalPointsList[index - 1];

    const isStop = !isFirst && !isLast && !!step.duration;
    const isVia = pathItemPositions.slice(1, -1).some((p) => p / 1000 === step.position);
    const isPathStep = isFirst || isVia || isLast;

    const startTime =
      isFirst || isStop
        ? addDurationToDate(step.time, step.duration ?? Duration.zero).toLocaleString(
            dateTimeLocale,
            { timeStyle: 'short' }
          )
        : '';
    const endTime =
      isLast || isStop ? step.time.toLocaleString(dateTimeLocale, { timeStyle: 'short' }) : '';

    let passageStop = '';
    if (!isFirst && !isLast) {
      // display the stop duration if is a stop, the passage time if not
      passageStop = step.duration
        ? getStopDurationTime(step.duration)
        : step.time.toLocaleString(dateTimeLocale, { timeStyle: 'short' });
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
