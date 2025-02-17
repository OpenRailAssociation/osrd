import { useCallback, useEffect, useState } from 'react';

import { isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type {
  IncompatibleConstraints,
  PathfindingInputError,
  PathfindingResultSuccess,
  PostInfraByInfraIdPathPropertiesApiArg,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import {
  formatSuggestedOperationalPoints,
  getPathfindingQuery,
  matchPathStepAndOp,
} from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure, setWarning } from 'reducers/main';
import { replaceItinerary, updatePathSteps } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getPathSteps,
  getPowerRestrictions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { isEmptyArray } from 'utils/array';
import { Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';

import useInfraStatus from './useInfraStatus';
import getPointOnPathCoordinates from '../helpers/getPointOnPathCoordinates';
import getTrackLengthCumulativeSums from '../helpers/getTrackLengthCumulativeSums';
import type { PathfindingState } from '../types';

const initialPathfindingState = {
  isRunning: false,
  isDone: false,
  isMissingParam: false,
};

const usePathfinding = (
  setPathProperties: (pathProperties?: ManageTrainSchedulePathProperties) => void
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const pathSteps = useSelector(getPathSteps);
  const powerRestrictions = useSelector(getPowerRestrictions);
  const { infra, reloadCount, setIsInfraError } = useInfraStatus();
  const { getRollingStockID } = useOsrdConfSelectors();
  const currentRollingStockId = useSelector(getRollingStockID);

  const [pathfindingState, setPathfindingState] =
    useState<PathfindingState>(initialPathfindingState);

  const [getRollingStockById] =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useLazyQuery();
  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  const { infraId, getTrackSectionsByIds } = useScenarioContext();

  const setIsMissingParam = () =>
    setPathfindingState({ ...initialPathfindingState, isMissingParam: true });
  const setIsRunning = () => setPathfindingState({ ...initialPathfindingState, isRunning: true });
  const setIsDone = () => setPathfindingState({ ...initialPathfindingState, isDone: true });
  const setError = (error?: string) => setPathfindingState({ ...initialPathfindingState, error });

  const handleInvalidPathItems = (
    steps: PathStep[],
    invalidPathItems: Extract<PathfindingInputError, { error_type: 'invalid_path_items' }>['items']
  ) => {
    const updatedPathSteps = steps.map((step, index) => ({
      ...step,
      isInvalid: invalidPathItems.some((item) => item.index === index),
    }));

    if (invalidPathItems.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      launchPathfinding(updatedPathSteps);
    } else {
      setError(t('missingPathSteps'));
    }
  };

  const populateStoreWithPathfinding = async (
    pathStepsInput: PathStep[],
    pathResult: PathfindingResultSuccess,
    incompatibleConstraints?: IncompatibleConstraints
  ) => {
    const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
      infraId,
      props: ['electrifications', 'geometry', 'operational_points'],
      pathPropertiesInput: {
        track_section_ranges: pathResult.track_section_ranges,
      },
    };
    const { electrifications, geometry, operational_points } =
      await postPathProperties(pathPropertiesParams).unwrap();

    if (!electrifications || !geometry || !operational_points) {
      return;
    }

    const trackIds = pathResult.track_section_ranges.map((range) => range.track_section);
    const trackSectionsById = await getTrackSectionsByIds(trackIds);
    const tracksLengthCumulativeSums = getTrackLengthCumulativeSums(
      pathResult.track_section_ranges
    );

    const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
      operational_points,
      geometry,
      pathResult.length
    );

    // We update existing pathsteps with coordinates, positionOnPath and kp corresponding to the new pathfinding result
    const updatedPathSteps: (PathStep | null)[] = pathStepsInput.map((step, i) => {
      if (!step) return step;
      const correspondingOp = suggestedOperationalPoints.find((suggestedOp) =>
        matchPathStepAndOp(step, suggestedOp)
      );

      const theoreticalMargin = i === 0 ? step.theoreticalMargin || '0%' : step.theoreticalMargin;

      const stopFor =
        i === pathStepsInput.length - 1 && !step.stopFor ? Duration.zero : step.stopFor;

      return {
        ...step,
        positionOnPath: pathResult.path_item_positions[i],
        stopFor,
        theoreticalMargin,
        coordinates: getPointOnPathCoordinates(
          trackSectionsById,
          pathResult.track_section_ranges,
          tracksLengthCumulativeSums,
          pathResult.path_item_positions[i]
        ),
        ...(correspondingOp && {
          name: correspondingOp.name,
          uic: correspondingOp.uic,
          secondary_code: correspondingOp.ch,
          kp: correspondingOp.kp,
        }),
      };
    });

    dispatch(updatePathSteps(updatedPathSteps));

    setPathProperties({
      electrifications,
      geometry,
      suggestedOperationalPoints,
      length: pathResult.length,
      trackSectionRanges: pathResult.track_section_ranges,
      incompatibleConstraints,
    });
  };

  const launchPathfinding = useCallback(
    async (
      steps: (PathStep | null)[],
      rollingStockId = currentRollingStockId,
      options = { isInitialization: false }
    ) => {
      if (!options.isInitialization) {
        dispatch(replaceItinerary(steps));
        if (!isEmptyArray(powerRestrictions)) {
          dispatch(
            setWarning({
              title: t('warningMessages.pathfindingChange'),
              text: t('warningMessages.powerRestrictionsReset'),
            })
          );
        }
      }
      setPathProperties(undefined);

      if (!steps.every((step) => step !== null)) {
        setIsMissingParam();
        return;
      }

      if (infra?.state !== 'CACHED') {
        return;
      }

      setIsRunning();

      const rollingStock = rollingStockId
        ? await getRollingStockById({ rollingStockId }).unwrap()
        : undefined;
      const pathfindingInput = getPathfindingQuery({
        infraId,
        rollingStock,
        pathSteps: steps.filter((step) => !step.isInvalid),
      });

      if (!pathfindingInput) {
        setIsMissingParam();
        return;
      }

      try {
        const pathfindingResult = await postPathfindingBlocks(pathfindingInput).unwrap();

        if (pathfindingResult.status === 'success') {
          await populateStoreWithPathfinding(steps, pathfindingResult);
          setIsDone();
          return;
        }

        const incompatibleConstraintsCheck =
          pathfindingResult.failed_status === 'pathfinding_not_found' &&
          pathfindingResult.error_type === 'incompatible_constraints';

        if (incompatibleConstraintsCheck) {
          await populateStoreWithPathfinding(
            steps,
            pathfindingResult.relaxed_constraints_path,
            pathfindingResult.incompatible_constraints
          );
          setError(t(`pathfindingErrors.${pathfindingResult.error_type}`));
          return;
        }

        const hasInvalidPathItems =
          pathfindingResult.failed_status === 'pathfinding_input_error' &&
          pathfindingResult.error_type === 'invalid_path_items';

        if (hasInvalidPathItems) {
          handleInvalidPathItems(steps, pathfindingResult.items);
          return;
        }

        let error: string;
        if (pathfindingResult.failed_status === 'internal_error') {
          const translationKey = pathfindingResult.core_error.type.startsWith('core:')
            ? pathfindingResult.core_error.type.replace('core:', '')
            : pathfindingResult.core_error.type;
          error = t(`coreErrors.${translationKey}`, {
            defaultValue: pathfindingResult.core_error.message,
          });
        } else {
          error = t(`pathfindingErrors.${pathfindingResult.error_type}`);
        }
        setError(error);
      } catch (e) {
        if (isObject(e)) {
          let error;
          if ('error' in e) {
            dispatch(setFailure(castErrorToFailure(e, { name: t('pathfinding') })));
            error = 'failedRequest';
          } else if ('data' in e && isObject(e.data) && 'message' in e.data) {
            error = e.data.message as string;
            if (e.data.message === 'Infra not loaded' || e.data.message === 'Invalid version') {
              setIsInfraError(true);
            }
          }
          setError(error);
        }
      }
    },
    [currentRollingStockId, infra]
  );

  useEffect(() => {
    if (infra?.state === 'CACHED') {
      launchPathfinding(pathSteps, currentRollingStockId, { isInitialization: true });
    }
  }, [infra?.state]);

  return {
    launchPathfinding,
    pathfindingState,
    infraInfo: {
      infra,
      reloadCount,
    },
  };
};

export default usePathfinding;
