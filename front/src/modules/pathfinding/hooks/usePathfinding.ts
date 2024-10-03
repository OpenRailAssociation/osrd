import { useState, useEffect, useReducer } from 'react';

import { compact, isEqual, isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type {
  PostInfraByInfraIdPathPropertiesApiArg,
  PostInfraByInfraIdPathfindingBlocksApiArg,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { initialState } from 'modules/pathfinding/consts';
import type { PathfindingAction, PathfindingState } from 'modules/pathfinding/types';
import {
  formatSuggestedOperationalPoints,
  getPathfindingQuery,
  upsertPathStepsInOPs,
} from 'modules/pathfinding/utils';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure, setWarning } from 'reducers/main';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { isEmptyArray } from 'utils/array';
import { castErrorToFailure } from 'utils/error';

import useInfraStatus from './useInfraStatus';

export function reducer(state: PathfindingState, action: PathfindingAction): PathfindingState {
  switch (action.type) {
    case 'PATHFINDING_STARTED': {
      return {
        ...state,
        running: true,
        done: false,
        error: '',
        mustBeLaunched: false,
        cancelled: false,
      };
    }
    case 'PATHFINDING_CANCELLED': {
      return {
        ...state,
        running: false,
        done: false,
        error: '',
        mustBeLaunched: false,
        cancelled: true,
      };
    }
    case 'PATHFINDING_FINISHED': {
      if (state.cancelled) {
        return {
          ...state,
          running: false,
          done: false,
          error: '',
          mustBeLaunched: false,
          mustBeLaunchedManually: false,
        };
      }
      return {
        ...state,
        running: false,
        done: true,
        error: '',
        mustBeLaunched: false,
        mustBeLaunchedManually: false,
      };
    }
    case 'PATHFINDING_ERROR': {
      return {
        ...state,
        running: false,
        done: false,
        error: action.message || '',
        mustBeLaunched: false,
      };
    }
    case 'PATHFINDING_INCOMPATIBLE_CONSTRAINTS': {
      return {
        ...state,
        running: false,
        done: false,
        error: action.message || '',
        mustBeLaunched: false,
      };
    }
    case 'PATHFINDING_PARAM_CHANGED':
    case 'VIAS_CHANGED': {
      if (
        !action.params ||
        state.running ||
        (!action.params.origin && !action.params.destination)
      ) {
        return { ...state };
      }
      const { origin, destination, rollingStock } = action.params;
      if (!origin || !destination || !rollingStock) {
        return {
          ...state,
          running: false,
          error: '',
          done: false,
          missingParam: true,
        };
      }
      return {
        ...state,
        error: '',
        mustBeLaunched: true,
        missingParam: false,
      };
    }
    default:
      throw new Error('Pathfinding action doesn’t exist');
  }
}

function init({
  origin,
  destination,
  rollingStock,
  pathSteps,
  pathProperties,
}: {
  origin: PathStep | null;
  destination: PathStep | null;
  rollingStock?: RollingStockWithLiveries;
  pathSteps: (PathStep | null)[];
  pathProperties?: ManageTrainSchedulePathProperties;
}): PathfindingState {
  if (compact(pathSteps).length === 0 || !pathProperties?.geometry) {
    return {
      ...initialState,
      mustBeLaunched: Boolean(origin) && Boolean(destination) && Boolean(rollingStock),
    };
  }
  return initialState;
}

export const usePathfinding = (
  setPathProperties?: (pathProperties?: ManageTrainSchedulePathProperties) => void | null,
  pathProperties?: ManageTrainSchedulePathProperties
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const { getInfraID, getOrigin, getDestination, getVias, getPathSteps, getPowerRestriction } =
    useOsrdConfSelectors();
  const infraId = useSelector(getInfraID, isEqual);
  const origin = useSelector(getOrigin, isEqual);
  const destination = useSelector(getDestination, isEqual);
  const vias = useSelector(getVias(), isEqual);
  const pathSteps = useSelector(getPathSteps);
  const powerRestrictions = useSelector(getPowerRestriction);
  const { infra, reloadCount, setIsInfraError } = useInfraStatus();
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const initializerArgs = {
    origin,
    destination,
    rollingStock,
    pathSteps,
    pathProperties,
  };
  const [pathfindingState, pathfindingDispatch] = useReducer(reducer, initializerArgs, init);

  const [isPathfindingInitialized, setIsPathfindingInitialized] = useState(false);

  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useMutation();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useMutation();

  const { updatePathSteps } = useOsrdConfActions();

  const [invalidItems, setInvalidItems] = useState<string[]>([]);

  const generatePathfindingParams = (): PostInfraByInfraIdPathfindingBlocksApiArg | null => {
    setPathProperties?.(undefined);

    const filteredPathSteps = pathSteps.filter(
      (step) =>
        step !== null &&
        step.coordinates !== null &&
        !('trigram' in step && invalidItems.includes(step.trigram))
    );
    return getPathfindingQuery({
      infraId,
      rollingStock,
      origin,
      destination,
      pathSteps: filteredPathSteps,
    });
  };

  useEffect(() => {
    if (isPathfindingInitialized) {
      pathfindingDispatch({
        type: 'VIAS_CHANGED',
        params: {
          origin,
          destination,
          rollingStock,
        },
      });
    }
  }, [vias]);

  useEffect(() => {
    if (isPathfindingInitialized) {
      pathfindingDispatch({
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
          rollingStock,
        },
      });
    }
  }, [origin?.id, destination?.id, rollingStock]);

  useEffect(() => {
    if (invalidItems.length > 0) {
      pathfindingDispatch({
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
          rollingStock,
        },
      });
    }
  }, [invalidItems]);

  useEffect(() => {
    const startPathFinding = async () => {
      if (!pathfindingState.running) {
        pathfindingDispatch({ type: 'PATHFINDING_STARTED' });
        const pathfindingInput = generatePathfindingParams();
        if (!pathfindingInput || !infraId) {
          dispatch(
            setFailure({
              name: t('pathfinding'),
              message: t('pathfindingMissingParamsSimple'),
            })
          );
          return;
        }

        try {
          const pathfindingResult = await postPathfindingBlocks(pathfindingInput).unwrap();
          const incompatibleConstraintsCheck =
            pathfindingResult.status === 'failure' &&
            pathfindingResult.failed_status === 'pathfinding_not_found' &&
            pathfindingResult.error_type === 'incompatible_constraints';

          if (pathfindingResult.status === 'success' || incompatibleConstraintsCheck) {
            const pathResult =
              pathfindingResult.status === 'success'
                ? pathfindingResult
                : pathfindingResult.relaxed_constraints_path;

            const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
              infraId,
              props: ['electrifications', 'geometry', 'operational_points'],
              pathPropertiesInput: {
                track_section_ranges: pathResult.track_section_ranges,
              },
            };
            const { electrifications, geometry, operational_points } =
              await postPathProperties(pathPropertiesParams).unwrap();

            if (electrifications && geometry && operational_points) {
              const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
                operational_points,
                geometry,
                pathResult.length
              );

              // We update existing pathsteps with coordinates, positionOnPath and kp corresponding to the new pathfinding result
              const updatedPathSteps: (PathStep | null)[] = pathSteps.map((step, i) => {
                if (!step) return step;
                const trigramValue = 'trigram' in step ? step.trigram : 'no trigram found';
                const correspondingOp = suggestedOperationalPoints.find(
                  (suggestedOp) =>
                    ('uic' in step && suggestedOp.uic === step.uic && suggestedOp.ch === step.ch) ||
                    (suggestedOp.trigram === trigramValue && suggestedOp.ch === step.ch)
                );

                const theoreticalMargin = i === 0 ? '0%' : step.theoreticalMargin;
                const stopFor = i === pathSteps.length - 1 && !step.stopFor ? '0' : step.stopFor;
                const stopType =
                  i === pathSteps.length - 1 && !step.stopFor ? undefined : step.stopType;

                return {
                  ...step,
                  positionOnPath: pathResult.path_item_positions[i],
                  stopFor,
                  stopType,
                  theoreticalMargin,
                  ...(correspondingOp && {
                    name: correspondingOp.name,
                    uic: correspondingOp.uic,
                    ch: correspondingOp.ch,
                    kp: correspondingOp.kp,
                    coordinates: correspondingOp.coordinates,
                  }),
                };
              });

              if (!isEmptyArray(powerRestrictions)) {
                dispatch(
                  setWarning({
                    title: t('warningMessages.pathfindingChange'),
                    text: t('warningMessages.powerRestrictionsReset'),
                  })
                );
              }
              dispatch(
                updatePathSteps({ pathSteps: updatedPathSteps, resetPowerRestrictions: true })
              );

              const allWaypoints = upsertPathStepsInOPs(
                suggestedOperationalPoints,
                compact(updatedPathSteps)
              );

              if (setPathProperties)
                setPathProperties({
                  electrifications,
                  geometry,
                  suggestedOperationalPoints,
                  allWaypoints,
                  length: pathResult.length,
                  trackSectionRanges: pathResult.track_section_ranges,
                  incompatibleConstraints: incompatibleConstraintsCheck
                    ? pathfindingResult.incompatible_constraints
                    : undefined,
                });

              if (pathfindingResult.status === 'success') {
                pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });
              } else {
                pathfindingDispatch({
                  type: 'PATHFINDING_INCOMPATIBLE_CONSTRAINTS',
                  message: `pathfindingErrors.${pathfindingResult.error_type}`,
                });
              }
            }
          } else if (pathfindingResult.failed_status === 'internal_error') {
            pathfindingDispatch({
              type: 'PATHFINDING_ERROR',
              message: `pathfindingErrors.${pathfindingResult.core_error.message}`,
            });
          } else {
            pathfindingDispatch({
              type: 'PATHFINDING_ERROR',
              message: `pathfindingErrors.${pathfindingResult.error_type}`,
            });
          }
        } catch (e) {
          if (isObject(e)) {
            if ('error' in e) {
              dispatch(setFailure(castErrorToFailure(e, { name: t('pathfinding') })));
              pathfindingDispatch({ type: 'PATHFINDING_ERROR', message: 'failedRequest' });
            } else if ('data' in e && isObject(e.data) && 'message' in e.data) {
              pathfindingDispatch({ type: 'PATHFINDING_ERROR', message: e.data.message as string });
              if (e.data.message === 'Infra not loaded' || e.data.message === 'Invalid version') {
                setIsInfraError(true);
              }
            }
          }
        }
      }
    };

    if (infra && infra.state === 'CACHED' && pathfindingState.mustBeLaunched) {
      startPathFinding();
    }
  }, [pathfindingState.mustBeLaunched, infra, invalidItems]);

  useEffect(() => setIsPathfindingInitialized(true), []);

  return {
    isPathfindingInitialized,
    pathfindingState,
    pathfindingDispatch,
    infraInfos: {
      infra,
      reloadCount,
    },
    invalidItems,
  };
};
