import { useState, useEffect, useReducer } from 'react';

import { compact, isEqual, isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type {
  PostV2InfraByInfraIdPathPropertiesApiArg,
  PostV2InfraByInfraIdPathfindingBlocksApiArg,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { initialState } from 'modules/pathfinding/consts';
import type { PathfindingActionV2, PathfindingState } from 'modules/pathfinding/types';
import {
  formatSuggestedOperationalPoints,
  getPathfindingQuery,
  upsertViasInOPs,
} from 'modules/pathfinding/utils';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure, setWarning } from 'reducers/main';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import useInfraStatus from './useInfraStatus';

export function reducer(state: PathfindingState, action: PathfindingActionV2): PathfindingState {
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

export const usePathfindingV2 = (
  setPathProperties?: (pathProperties?: ManageTrainSchedulePathProperties) => void | null,
  pathProperties?: ManageTrainSchedulePathProperties
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const { getInfraID, getOriginV2, getDestinationV2, getViasV2, getPathSteps } =
    useOsrdConfSelectors();
  const infraId = useSelector(getInfraID, isEqual);
  const origin = useSelector(getOriginV2, isEqual);
  const destination = useSelector(getDestinationV2, isEqual);
  const vias = useSelector(getViasV2(), isEqual);
  const pathSteps = useSelector(getPathSteps);
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
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathfindingBlocks.useMutation();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  const { updatePathSteps } = useOsrdConfActions();

  const generatePathfindingParams = (): PostV2InfraByInfraIdPathfindingBlocksApiArg | null => {
    if (setPathProperties) setPathProperties(undefined);
    return getPathfindingQuery({ infraId, rollingStock, origin, destination, pathSteps });
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
  }, [origin, destination, rollingStock]);

  useEffect(() => {
    const startPathFinding = async () => {
      if (!pathfindingState.running) {
        pathfindingDispatch({ type: 'PATHFINDING_STARTED' });
        const pathfindingInputV2 = generatePathfindingParams();
        if (!pathfindingInputV2 || !infraId) {
          dispatch(
            setFailure({
              name: t('pathfinding'),
              message: t('pathfindingMissingParamsSimple'),
            })
          );
          return;
        }

        try {
          const pathfindingResult = await postPathfindingBlocks(pathfindingInputV2).unwrap();

          if (
            pathfindingResult.status === 'success' ||
            pathfindingResult.status === 'incompatible_constraints'
          ) {
            const pathResult =
              pathfindingResult.status === 'success'
                ? pathfindingResult
                : pathfindingResult.relaxed_constraints_path;

            const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
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
                const correspondingOp = suggestedOperationalPoints.find(
                  (suggestedOp) =>
                    'uic' in step && suggestedOp.uic === step.uic && suggestedOp.ch === step.ch
                );

                const stopFor = i === pathSteps.length - 1 && !step.stopFor ? '0' : step.stopFor;

                return {
                  ...step,
                  positionOnPath: pathResult.path_items_positions[i],
                  stopFor,
                  ...(correspondingOp && {
                    kp: correspondingOp.kp,
                    coordinates: correspondingOp.coordinates,
                  }),
                };
              });
              dispatch(
                updatePathSteps({ pathSteps: updatedPathSteps, resetPowerRestrictions: true })
              );
              dispatch(
                setWarning({
                  title: t('warningMessages.pathfindingChange'),
                  text: t('warningMessages.powerRestrictionsReset'),
                })
              );

              const allWaypoints = upsertViasInOPs(
                suggestedOperationalPoints,
                compact(updatedPathSteps)
              );

              if (pathfindingResult.status === 'success') {
                pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });
                if (setPathProperties)
                  setPathProperties({
                    electrifications,
                    geometry,
                    suggestedOperationalPoints,
                    allWaypoints,
                    length: pathResult.length,
                    trackSectionRanges: pathResult.track_section_ranges,
                  });
              } else {
                if (setPathProperties)
                  setPathProperties({
                    electrifications,
                    geometry,
                    suggestedOperationalPoints,
                    allWaypoints,
                    length: pathResult.length,
                    incompatibleConstraints: pathfindingResult.incompatible_constraints,
                    trackSectionRanges: pathResult.track_section_ranges,
                  });
                pathfindingDispatch({
                  type: 'PATHFINDING_INCOMPATIBLE_CONSTRAINTS',
                  message: `pathfindingErrors.${pathfindingResult.status}`,
                });
              }
            }
          } else {
            pathfindingDispatch({
              type: 'PATHFINDING_ERROR',
              message: `pathfindingErrors.${pathfindingResult.status}`,
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
  }, [pathfindingState.mustBeLaunched, infra]);

  useEffect(() => setIsPathfindingInitialized(true), []);

  return {
    isPathfindingInitialized,
    pathfindingState,
    pathfindingDispatch,
    infraInfos: {
      infra,
      reloadCount,
    },
  };
};
