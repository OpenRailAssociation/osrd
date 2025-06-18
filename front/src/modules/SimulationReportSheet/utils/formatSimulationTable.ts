/* eslint-disable no-nested-ternary */
import type { Style } from '@react-pdf/types';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmResultsOperationalPoint } from 'applications/stdcm/types';
import { dateToHHMMSS } from 'utils/date';
import { addDurationToDate, Duration } from 'utils/duration';
import { capitalizeFirstLetter } from 'utils/strings';

import { getStopDurationTime, getSecondaryCode } from './formatSimulationReportSheet';
import styles from '../styles/SimulationReportStyleSheet';
import type { SimulationTableScenarioProps, SimulationTableStdcmProps } from '../types';

type SimulationTableRow = {
  index: number;
  name: string;
  ch?: string | null;
  trackName?: string;
  endTime: string | Date | null;
  passageStop: string | Date | null;
  startTime: string | Date | null;
  weight: string;
  length?: string;
  referenceEngine: string;
  stopTypeLabel?: string;
  stopType?: string;
  isFirstStep: boolean;
  isLastStep: boolean;
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

const formatSimulationTable = (options: FormatSimulationTableProps): SimulationTableRow[] => {
  const { mode } = options;
  const operationalPoints = options.operationalPointsList;
  const isStdcm = mode === 'stdcm';
  const { t } = useTranslation('stdcm');

  return operationalPoints.map((step, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPoints.length - 1;
    const isIntermediate = !isFirst && !isLast;
    const previousStep = operationalPoints[index - 1];

    const hasDuration = isStdcm ? step.duration !== null : step.duration!.ms !== 0;
    const isStop = hasDuration && !isLast;

    let passageStop = '';
    let startTime = '';
    let endTime: string | Date | null = '';
    let trackName: string | undefined = '';
    let weight: string | undefined = '=';
    let length: string | undefined = '=';
    let stopTypeLabel = '';
    let stopType: string | undefined;
    let isVia = false;

    // handle stdcm mode
    if (isStdcm) {
      const stdcmStep = step as StdcmResultsOperationalPoint;
      isVia = options.stdcmData.simulationPathSteps
        .slice(1, -1)
        .some((s) => s.location?.name === step.name && getSecondaryCode(s) === step.ch);
      startTime = isFirst || hasDuration ? stdcmStep.stopEndTime : '';
      endTime = isLast || hasDuration ? step.time : '';
      stopTypeLabel = stdcmStep.stopType
        ? capitalizeFirstLetter(t(`trainPath.stopType.${stdcmStep.stopType}`))
        : t('reportSheet.serviceStop');
      trackName = stdcmStep.trackName;
      weight = isFirst ? `${Math.floor(options.consistMass)} t` : '=';
      length = isFirst ? `${options.consistLength} m` : '=';
      stopType = stdcmStep.stopType;
    }
    // handle operational studies mode
    else {
      const opStudyStep = step as OperationalPointWithTimeAndSpeed;
      isVia = options.path.path_item_positions
        .slice(1, -1)
        .some((p) => p / 1000 === opStudyStep.position);
      startTime =
        isFirst || hasDuration
          ? dateToHHMMSS(addDurationToDate(step.time as Date, step.duration!), {
              withoutSeconds: true,
            })
          : '';
      endTime =
        isLast || hasDuration ? dateToHHMMSS(step.time as Date, { withoutSeconds: true }) : '';
      trackName = opStudyStep.track_name || '-';
      weight = isFirst ? `${Math.floor((options.rollingStock?.mass || 0) / 1000)} t` : '=';
    }

    const isViaWithoutStop = isVia && !hasDuration;

    const tdPassageStopStyle = isViaWithoutStop
      ? { ...styles.simulation.td, paddingLeft: '' }
      : styles.simulation.td;
    const passageStopStyle = isStop
      ? {
          width: `${
            step.duration! < new Duration({ seconds: 600 }) &&
            step.duration! >= new Duration({ seconds: 60 })
              ? 60
              : 70
          }px`,
          ...styles.simulation.blueStop,
        }
      : isViaWithoutStop
        ? { ...styles.simulation.stopColumn, marginLeft: '' }
        : styles.simulation.stopColumn;

    if (isIntermediate) {
      if (hasDuration) {
        passageStop = getStopDurationTime(step.duration!);
      } else if (isStdcm) {
        passageStop = String(step.time);
      } else {
        passageStop = dateToHHMMSS(step.time as Date, { withoutSeconds: true });
      }
    }

    return {
      index,
      name:
        isIntermediate && !isVia && step.name === previousStep.name
          ? '='
          : step.name || t('reportSheet.unknown'),
      ch: step.ch,
      trackName,
      endTime,
      passageStop,
      startTime,
      weight,
      length,
      referenceEngine: isFirst ? options.rollingStock?.name || '' : '=',
      stopTypeLabel,
      stopType,
      isFirstStep: isFirst,
      isLastStep: isLast,
      rowStyle: isStop ? styles.simulation.blueRow : styles.simulation.tbody,
      stylesByColumn: {
        index: isViaWithoutStop
          ? styles.simulation.indexColumnPassageStop
          : styles.simulation.indexColumn,
        name: isViaWithoutStop
          ? styles.simulation.opColumnPassageStop
          : isIntermediate && hasDuration
            ? styles.simulation.opStop
            : styles.simulation.td,
        ch: isViaWithoutStop ? styles.simulation.chColumnPassageStop : styles.simulation.chColumn,
        trackName: styles.simulation.td,
        passageStop: passageStopStyle,
        others: tdPassageStopStyle,
      },
    };
  });
};

export default formatSimulationTable;
