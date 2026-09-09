import type { TFunction } from 'i18next';

import type {
  StdcmSimulationOutputs,
  StdcmSuccessResponse,
  StdcmPathProperties,
  StdcmResultsOperationalPoint,
} from 'applications/stdcm/types';
import type { SimulationTableRow } from 'modules/SimulationReportSheet/types';
import {
  dateToHHMM,
  getStopDurationTime,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
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
  t: TFunction<'stdcm'>,
  pathfindingResult: StdcmSuccessResponse['pathfinding_result']
) => {
  let currentConsist = {
    totalLength: `${consist.length} m`,
    totalMass: `${consist.mass} t`,
  };
  const backtrackPositions = (pathfindingResult?.backtrack_path_items ?? []).map(
    (index) => pathfindingResult.path_item_positions[index]
  );
  return operationalPointsList.map((op, index): SimulationTableRow => {
    const isFirst = index === 0;
    const isLast = index === operationalPointsList.length - 1;
    const previousOp = operationalPointsList[index - 1];

    const isStop = op.stopDuration !== null && !isLast;
    const isVia = stdcmPathSteps.slice(1, -1).some((step) => step.operationalPoint!.id === op.opId);
    const isPathStep = isFirst || isVia || isLast;

    const isBackTrack = backtrackPositions.includes(op.positionOnPath);

    const startTime = isFirst || isStop ? dateToHHMM(op.stopEndTime) : '';
    const endTime = isLast || isStop ? dateToHHMM(op.time) : '';
    const { stopType, trackName } = op;

    const stopTypeLabel = stopType
      ? capitalizeFirstLetter(t(`trainPath.stopType.${stopType}`))
      : t('reportSheet.serviceStop');

    let passageStop = '';
    if (!isFirst && !isLast) {
      passageStop =
        op.stopDuration !== null ? getStopDurationTime(op.stopDuration) : dateToHHMM(op.time);
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
      secondaryCode: op.secondaryCode,
      secondaryCodeLabel: op.secondaryCodeLabel,
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
      isBackTrack,
      consistChanges,
      ...getRowStyle(op.stopDuration, isPathStep, isFirst, isLast),
    };
  });
};
