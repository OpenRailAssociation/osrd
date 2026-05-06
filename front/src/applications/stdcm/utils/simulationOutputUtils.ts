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

type ConsistChangeParameters = {
  totalMass: number;
  totalLength: number;
  rollingStockName: string;
  towedRollingStockName?: string;
};

type ConsistChangeContext = {
  currentConsist: ConsistChangeParameters;
  updatedConsist: ConsistChangeParameters;
};

type ConsistParameters = {
  /** In ton */
  mass: number;
  /** In meters */
  length: number;
  rollingStockName: string;
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
      currentConsist = simulationPathSteps[i].consistChange! as ConsistChangeParameters;
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
  consist: ConsistParameters,
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

    const intermediatePathSteps: StdcmViaPathStep[] = stdcmPathSteps.filter(
      (pathStep) => pathStep.isVia
    );

    const consistChangesData = getConsistChangesAroundStep(step.opId!, intermediatePathSteps, {
      totalLength: consist.length,
      totalMass: consist.mass,
      rollingStockName: consist.rollingStockName,
    });

    const consistChanges = consistChangesData
      ? {
          currentConsist: {
            totalLength: `${consistChangesData?.currentConsist.totalLength} m`,
            totalMass: `${consistChangesData?.currentConsist.totalMass} t`,
          },
          updatedConsist: {
            totalLength: `${consistChangesData.updatedConsist.totalLength} m`,
            totalMass: `${consistChangesData.updatedConsist.totalMass} t`,
            rollingStockName: consistChangesData.updatedConsist.rollingStockName,
            towedRollingStockName: consistChangesData.updatedConsist.towedRollingStockName,
          },
        }
      : undefined;

    return {
      name:
        !isPathStep && step.name === previousStep.name
          ? '='
          : step.name || t('reportSheet.unknown'),
      ch: step.secondaryCode,
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
