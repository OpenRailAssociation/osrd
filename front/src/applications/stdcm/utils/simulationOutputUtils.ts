import type { TFunction } from 'i18next';

import type {
  StdcmSimulationOutputs,
  StdcmSuccessResponse,
  StdcmPathProperties,
  StdcmResultsOperationalPoint,
} from 'applications/stdcm/types';
import { getStopDurationTime } from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { getRowStyle } from 'modules/SimulationReportSheet/utils/formatSimulationTable';
import type { SpeedDistanceDiagramData } from 'modules/simulationResult/types';
import { capitalizeFirstLetter } from 'utils/strings';

export const hasResults = (
  outputs?: StdcmSimulationOutputs
): outputs is {
  pathProperties: StdcmPathProperties;
  results: StdcmSuccessResponse;
  speedDistanceDiagramData: SpeedDistanceDiagramData;
} => !!outputs && 'results' in outputs;

type ConsistParameters = {
  /** In ton */
  mass: number;
  /** In meters */
  length: number;
  rollingStockName: string;
};

export const formatStdcmDataForSimulationTable = (
  operationalPointsList: StdcmResultsOperationalPoint[],
  stdcmPathSteps: StdcmSuccessResponse['simulationPathSteps'],
  consist: ConsistParameters,
  t: TFunction<'stdcm'>
) => {
  let currentConsist = {
    totalLength: `${consist.length} m`,
    totalMass: `${consist.mass} t`,
  };

  return operationalPointsList.map((op, index) => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousOp = operationalPointsList[index - 1];

    const isStop = op.duration !== null && !isLast;
    const isVia = stdcmPathSteps.slice(1, -1).some((step) => step.operationalPoint!.id === op.opId);
    const isPathStep = isFirst || isVia || isLast;

    const startTime = isFirst || isStop ? op.stopEndTime : '';
    const endTime = isLast || isStop ? op.time : '';
    const { stopType, trackName } = op;

    const stopTypeLabel = stopType
      ? capitalizeFirstLetter(t(`trainPath.stopType.${stopType}`))
      : t('reportSheet.serviceStop');

    let passageStop = '';
    if (!isFirst && !isLast) {
      passageStop = op.duration !== null ? getStopDurationTime(op.duration) : String(op.time);
    }

    let consistChanges;
    if (op.consistChange) {
      consistChanges = {
        currentConsist,
        updatedConsist: {
          totalLength: `${op.consistChange.totalLength} m`,
          totalMass: `${op.consistChange.totalMass} t`,
          rollingStockName: op.consistChange.rollingStockName!,
          towedRollingStockName: op.consistChange.towedRollingStockName,
        },
      };
      currentConsist = {
        totalLength: `${op.consistChange.totalLength} m`,
        totalMass: `${op.consistChange.totalMass} t`,
      };
    }

    return {
      name: !isPathStep && op.name === previousOp.name ? '=' : op.name || t('reportSheet.unknown'),
      ch: op.secondaryCode,
      trackName,
      endTime,
      passageStop,
      startTime,
      ...(isFirst
        ? {
            weight: `${consist.mass} t`,
            length: `${consist.length} m`,
            referenceEngine: consist.rollingStockName,
          }
        : { weight: '=', length: '=', referenceEngine: '=' }),
      stopTypeLabel,
      stopType,
      consistChanges,
      ...getRowStyle(op.duration, isPathStep, isFirst, isLast),
    };
  });
};
