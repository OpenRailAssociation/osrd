import { useEffect, useMemo, useState } from 'react';

import { compact, isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { stdcmPathStepToPathItemLocation } from 'applications/stdcm/utils';
import {
  osrdEditoastApi,
  type PathfindingResult,
  type Infra,
  type WorkerStatus,
} from 'common/api/osrdEditoastApi';
import {
  getStdcmPathSteps,
  getLoadingGauge,
  getStdcmSpeedLimitByTag,
  getTrackSectionIdsByLoadingGauge,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

import {
  getConsistChanges,
  getPathSegmentsIndexes,
  launchSegmentedPathfinding,
} from '../utils/getConsistChangesConstraints';
import useStdcmLightRollingStock from './useStdcmLightRollingStock';

/**
 * Compute the path items locations from the path steps
 */
function pathStepsToLocations(
  pathSteps: StdcmPathStep[]
): Array<NonNullable<StdcmPathStep['operationalPoint']>> {
  return compact(pathSteps.map((s) => s.operationalPoint));
}

const useStaticPathfinding = (workerStatus: WorkerStatus, infra: Infra | undefined) => {
  const pathSteps = useSelector(getStdcmPathSteps);
  const [pathStepsLocations, setPathStepsLocations] = useState(pathStepsToLocations(pathSteps));

  const speedLimitByTag = useSelector(getStdcmSpeedLimitByTag);
  const rollingStock = useStdcmLightRollingStock();
  const loadingGauge = useSelector(getLoadingGauge);
  const trackSectionIdsByLoadingGauge = useSelector(getTrackSectionIdsByLoadingGauge);

  const [pathfinding, setPathfinding] = useState<PathfindingResult>();
  const [showPathfindingStatusMessage, setShowPathfindingStatusMessage] = useState(false);

  const [postPathfindingBlocks, { isFetching }] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery();

  const { t } = useTranslation('stdcm');
  const [getLightRollingStockById] =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useLazyQuery();

  const consistChanges = useMemo(() => getConsistChanges(pathSteps), [pathSteps]);

  // When pathSteps changed
  // => update the pathStepsLocations (if needed by doing a deep comparison).
  useEffect(() => {
    setPathStepsLocations((prev) => {
      const newSteps = pathStepsToLocations(pathSteps);
      if (isEqual(prev, newSteps)) return prev;
      return newSteps;
    });
  }, [pathSteps]);

  useEffect(() => {
    const launchPathfinding = async () => {
      setPathfinding(undefined);
      if (!infra || workerStatus !== 'READY' || !rollingStock || pathStepsLocations.length < 2) {
        return;
      }

      if (pathStepsLocations.some((step) => !step.secondaryCode)) {
        return;
      }

      // Don't run the pathfinding if the origin and destination are the same:
      const origin = pathSteps.at(0)!;
      const destination = pathSteps.at(-1)!;
      if (!origin.operationalPoint || !destination.operationalPoint) {
        return;
      }
      if (origin.operationalPoint.id === destination.operationalPoint.id) {
        return;
      }

      const stdcmPathSteps = pathStepsLocations.map((step) =>
        stdcmPathStepToPathItemLocation(step)
      );

      const pathSegmentsIndexes = getPathSegmentsIndexes(consistChanges, pathStepsLocations.length);

      setShowPathfindingStatusMessage(true);

      const allowedTrackSections =
        trackSectionIdsByLoadingGauge && loadingGauge
          ? trackSectionIdsByLoadingGauge[loadingGauge]
          : undefined;

      const pathfindingResult = await launchSegmentedPathfinding({
        pathSegmentsIndexes,
        stdcmPathSteps,
        consistChanges,
        getLightRollingStockById,
        postPathfindingBlocks,
        infraId: infra.id,
        rollingStock,
        loadingGauge,
        speedLimitByTag,
        allowedTrackSections,
      });

      setPathfinding(pathfindingResult);

      if (pathfindingResult?.status === 'failure') {
        setShowPathfindingStatusMessage(false);
      }
    };

    launchPathfinding();
  }, [
    pathStepsLocations,
    rollingStock,
    speedLimitByTag,
    loadingGauge,
    trackSectionIdsByLoadingGauge,
    infra,
    workerStatus,
    consistChanges,
  ]);

  const pathfindingStatusMessage = useMemo(() => {
    if (isFetching) {
      return t('pathfindingStatus.calculating');
    }
    return t('pathfindingStatus.success');
  }, [isFetching]);

  return {
    pathfinding,
    pathfindingStatusMessage,
    showPathfindingStatusMessage,
    setShowPathfindingStatusMessage,
  };
};

export default useStaticPathfinding;
