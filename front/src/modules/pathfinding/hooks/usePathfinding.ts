import { useCallback, useEffect, useState } from 'react';

import { isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { ManageTimetableItemPathProperties } from 'applications/operationalStudies/types';
import type {
  IncompatibleConstraints,
  PathfindingInputError,
  PathfindingResultSuccess,
  PostInfraByInfraIdPathPropertiesApiArg,
  RelatedOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import {
  formatSuggestedOperationalPoints,
  getPathfindingQuery,
  matchPathStepAndOp,
} from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/timetableItem/types';
import { setFailure, setWarning } from 'reducers/main';
import { replaceItinerary, updatePathSteps } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getOperationalStudiesSpeedLimitByTag,
  getPathSteps,
  getPowerRestrictions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { isEmptyArray } from 'utils/array';
import { Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';

import getPointOnPathCoordinates from '../helpers/getPointOnPathCoordinates';
import getTrackLengthCumulativeSums from '../helpers/getTrackLengthCumulativeSums';
import type { PathfindingState } from '../types';

const initialPathfindingState = {
  isRunning: false,
  isDone: false,
  isMissingParam: false,
};

const usePathfinding = ({
  rollingStockId: currentRollingStockId,
}: {
  rollingStockId: number | undefined;
}) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const dispatch = useAppDispatch();
  const pathSteps = useSelector(getPathSteps);
  const speedLimitByTag = useSelector(getOperationalStudiesSpeedLimitByTag);

  const powerRestrictions = useSelector(getPowerRestrictions);
  const { infraId, getTrackSectionsByIds, workerStatus } = useScenarioContext();
  const [pathfindingState, setPathfindingState] =
    useState<PathfindingState>(initialPathfindingState);
  const [pathProperties, setPathProperties] = useState<ManageTimetableItemPathProperties>();

  const [getRollingStockById] =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useLazyQuery();
  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  const [matchAllOperationalPoints] =
    osrdEditoastApi.endpoints.matchAllOperationalPoints.useLazyQuery();

  /**
   * Fetches operational point data for the given path steps using a search API call
   * and updates each step with the matched operational point's name, uic, ch and coordinates (if found).
   *
   * This is useful when the pathfinding can not be ran or fails.
   * If pathfinding is successful, calling this function is unnecessary.
   *
   * @param steps - An array of `PathStep` objects to be enriched with operational point data.
   */
  const fetchPathStepsOperationalPointData = useCallback(
    async (steps: PathStep[]) => {
      if (!infraId || !steps.length) return;

      const opRefs = steps.flatMap((step) => {
        const pathItemLocation = getStepLocation(step.location);
        if ('track' in pathItemLocation) return [];
        return [pathItemLocation];
      });

      let ops: RelatedOperationalPoint[][];
      try {
        ops = await matchAllOperationalPoints({
          infraId,
          opRefs,
        }).unwrap();
      } catch (error) {
        console.error('Error fetching operational points:', error);
        return;
      }

      let opIndex = 0;
      const updatedSteps = steps.map((step): PathStep => {
        if ('track' in step.location) return step;

        const op = ops[opIndex].at(0);
        opIndex++;
        if (!op) return step;

        return {
          ...step,
          ...(op.extensions?.identifier?.name && { name: op.extensions.identifier.name }),
          ...(op.extensions?.identifier?.uic && { uic: op.extensions.identifier.uic }),
          ...(op.extensions?.sncf?.ch && { ch: op.extensions.sncf.ch }),
          ...(op.geo && { coordinates: op.geo.coordinates }),
        };
      });

      dispatch(updatePathSteps(updatedSteps));
    },
    [infraId]
  );

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
      pathPropertiesInput: {
        track_section_ranges: pathResult.path.track_section_ranges,
      },
    };
    const { electrifications, geometry, operational_points } =
      await postPathProperties(pathPropertiesParams).unwrap();

    const trackIds = pathResult.path.track_section_ranges.map((range) => range.track_section);
    const trackSectionsById = await getTrackSectionsByIds(trackIds);
    const tracksLengthCumulativeSums = getTrackLengthCumulativeSums(
      pathResult.path.track_section_ranges
    );

    const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
      operational_points,
      geometry,
      pathResult.length
    );

    let validOpIndex = 0;

    // We update existing pathsteps with coordinates, positionOnPath and kp corresponding to the new pathfinding result
    const updatedPathSteps: (PathStep | null)[] = pathStepsInput.map((step, i) => {
      if (!step) return step;
      if (step.isInvalid) {
        return {
          ...step,
          coordinates: undefined,
          positionOnPath: undefined,
        };
      }
      const positionOnPath = pathResult.path_item_positions[validOpIndex];
      const coordinates = getPointOnPathCoordinates(
        trackSectionsById,
        pathResult.path.track_section_ranges,
        tracksLengthCumulativeSums,
        positionOnPath
      );
      const correspondingOp = suggestedOperationalPoints.find((suggestedOp) =>
        matchPathStepAndOp(step.location, suggestedOp)
      );

      const theoreticalMargin = i === 0 ? step.theoreticalMargin || '0%' : step.theoreticalMargin;

      const stopFor =
        i === pathStepsInput.length - 1 && !step.stopFor ? Duration.zero : step.stopFor;

      validOpIndex += 1;
      return {
        ...step,
        positionOnPath,
        stopFor,
        theoreticalMargin,
        coordinates,
        name: correspondingOp?.name || step.name,
        ...(correspondingOp && {
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
      trackSectionRanges: pathResult.path.track_section_ranges,
      incompatibleConstraints,
    });
  };

  const launchPathfinding = useCallback(
    async (
      steps: (PathStep | null)[],
      rollingStockId = currentRollingStockId,
      options: { isInitialization: boolean; speedLimitTag?: string | null } = {
        isInitialization: false,
        speedLimitTag: undefined,
      }
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

      if (workerStatus !== 'READY') {
        return;
      }

      setIsRunning();

      const rollingStock = rollingStockId
        ? await getRollingStockById({ rollingStockId }).unwrap()
        : undefined;
      const pathfindingInput = getPathfindingQuery({
        infraId,
        rollingStock,
        pathSteps: steps.filter((step) => !step.isInvalid).map((step) => step?.location),
        speedLimitByTag:
          options.speedLimitTag !== undefined ? options.speedLimitTag : speedLimitByTag,
      });

      if (!pathfindingInput) {
        setIsMissingParam();
        await fetchPathStepsOperationalPointData(steps.filter((step) => step !== null));
        return;
      }

      try {
        const pathfindingResult = await postPathfindingBlocks(pathfindingInput).unwrap();

        if (pathfindingResult.status === 'success') {
          await populateStoreWithPathfinding(steps, pathfindingResult);
          setIsDone();
          return;
        }

        await fetchPathStepsOperationalPointData(steps.filter((step) => step !== null));

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
          }
          setError(error);
        }
      }
    },
    [currentRollingStockId, workerStatus, speedLimitByTag]
  );

  useEffect(() => {
    if (workerStatus === 'READY') {
      launchPathfinding(pathSteps, currentRollingStockId, { isInitialization: true });
    }
  }, [workerStatus]);

  return {
    launchPathfinding,
    pathfindingState,
    pathProperties,
  };
};

export default usePathfinding;
