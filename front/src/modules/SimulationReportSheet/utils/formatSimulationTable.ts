import type { Style } from '@react-pdf/types';
import type { TFunction } from 'i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { CorePathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { timeToLocaleStringRounded } from 'utils/date';
import { addDurationToDate, Duration } from 'utils/duration';
import { kgToT } from 'utils/physics';

import styles from '../styles/SimulationReportStyleSheet';
import { getStopDurationTime } from './formatSimulationReportSheet';

export const getRowStyle = (
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

export const formatOperationalStudiesDataForSimulationTable = (
  operationalPointsList: OperationalPointWithTimeAndSpeed[],
  pathItemPositions: CorePathfindingResultSuccess['path_item_positions'],
  rollingStock: { mass: number; name: string },
  t: TFunction<'stdcm'>,
  dateTimeLocale: Intl.Locale
) =>
  operationalPointsList.map((step, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousStep = operationalPointsList[index - 1];

    const isVia = pathItemPositions.slice(1, -1).some((p) => p / 1000 === step.position);
    const isPathStep = isFirst || isVia || isLast;

    const endTime =
      !isFirst && !!step.duration ? timeToLocaleStringRounded(step.time, dateTimeLocale) : '';

    let passageStop = '';
    if (!isFirst && (!isLast || !step.duration)) {
      // display the stop duration if is a stop, the passage time if not
      passageStop = step.duration
        ? getStopDurationTime(step.duration)
        : timeToLocaleStringRounded(step.time, dateTimeLocale);
    }

    const startTime =
      isFirst || (!isLast && !!step.duration)
        ? timeToLocaleStringRounded(
            addDurationToDate(step.time, step.duration ?? Duration.zero),
            dateTimeLocale
          )
        : '';

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
