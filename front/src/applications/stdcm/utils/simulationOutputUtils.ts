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
import type { StdcmViaPathStep } from 'reducers/osrdconf/types';
import { capitalizeFirstLetter } from 'utils/strings';

export const hasResults = (
  outputs?: StdcmSimulationOutputs
): outputs is {
  pathProperties: StdcmPathProperties;
  results: StdcmSuccessResponse;
  speedDistanceDiagramData: SpeedDistanceDiagramData;
} => !!outputs && 'results' in outputs;

type ConsistChangeParameters = { totalMass?: number; totalLength?: number };

type ConsistChangeContext = {
  currentConsist: ConsistChangeParameters;
  updatedConsist: ConsistChangeParameters;
};

export function getConsistChangesAroundStep(
  opId: string,
  simulationPathSteps: StdcmViaPathStep[],
  initialConsist: ConsistChangeParameters
): ConsistChangeContext | undefined {
  const stepIndex = simulationPathSteps.findIndex((step) => step.operationalPoint?.id === opId);

  if (stepIndex === -1) return undefined;

  const consistChangeForThisStep = simulationPathSteps[stepIndex].consistChange;

  if (!consistChangeForThisStep) return undefined;

  let currentConsist: ConsistChangeParameters = initialConsist;
  for (let i = stepIndex - 1; i >= 0; i--) {
    if (simulationPathSteps[i].consistChange) {
      currentConsist = simulationPathSteps[i].consistChange!;
      break;
    }
  }

  const { totalLength, totalMass, rollingStockName, towedRollingStockName } =
    consistChangeForThisStep;
  const updatedConsist = {
    totalLength: totalLength!,
    totalMass: totalMass!,
    rollingStockName: rollingStockName ?? currentConsist.rollingStockName,
    towedRollingStockName,
  };

  return { currentConsist, updatedConsist };
}

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
    const isVia = stdcmPathSteps.slice(1, -1).some((s) => s.operationalPoint!.id === step.opId);
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

    const intermediatePathSteps = stdcmPathSteps.slice(1, -1) as StdcmViaPathStep[];

    const consistChanges = getConsistChangesAroundStep(step.opId!, intermediatePathSteps, {
      totalLength: consist.length,
      totalMass: consist.mass,
    });

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
      consistChanges,
      ...getRowStyle(step.duration, isPathStep, isFirst, isLast),
    };
  });
