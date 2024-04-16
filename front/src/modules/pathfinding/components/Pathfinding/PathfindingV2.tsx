import React, { useState, useEffect, useReducer } from 'react';

import { Alert, CheckCircle, Stop } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { compact, isEqual, isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import type {
  PostV2InfraByInfraIdPathPropertiesApiArg,
  PostV2InfraByInfraIdPathfindingBlocksApiArg,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Spinner } from 'common/Loaders';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { initialState } from 'modules/pathfinding/consts';
import type { PathfindingActionV2, PathfindingState } from 'modules/pathfinding/types';
import {
  formatSuggestedOperationalPoints,
  getPathfindingQuery,
  insertViasInOPs,
} from 'modules/pathfinding/utils';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';

import { InfraHardError, InfraSoftError } from './InfraError';

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
    case 'PATHFINDING_PARAM_CHANGED':
    case 'VIAS_CHANGED':
    case 'INFRA_CHANGED': {
      if (
        !action.params ||
        state.running ||
        (action.type === 'INFRA_CHANGED' && !action.params.origin && !action.params.destination)
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

type PathfindingProps = {
  pathProperties?: ManageTrainSchedulePathProperties;
  setPathProperties: (pathProperties?: ManageTrainSchedulePathProperties) => void;
};

const Pathfinding = ({ pathProperties, setPathProperties }: PathfindingProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const {
    getInfraID,
    getOriginV2,
    getDestinationV2,
    getViasV2,
    getPathSteps,
    // getPowerRestrictionRanges,
    // getAllowances,
  } = useOsrdConfSelectors();
  const infraId = useSelector(getInfraID, isEqual);
  const origin = useSelector(getOriginV2, isEqual);
  const destination = useSelector(getDestinationV2, isEqual);
  const vias = useSelector(getViasV2(), isEqual);
  const pathSteps = useSelector(getPathSteps);
  const { rollingStock } = useStoreDataForRollingStockSelector();
  // TODO TS2 : update this parts in margins and powerrestriction issues
  // const powerRestrictions = useSelector(getPowerRestrictionRanges, isEqual);
  // const allowances = useSelector(getAllowances, isEqual);
  const initializerArgs = {
    origin,
    destination,
    rollingStock,
    pathSteps,
    pathProperties,
  };
  const [pathfindingState, pathfindingDispatch] = useReducer(reducer, initializerArgs, init);
  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const [isInfraError, setIsInfraError] = useState(false);

  const [isPathfindingInitialized, setIsPathfindingInitialized] = useState(false);

  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathfindingBlocks.useMutation();
  const [postPathProperties] =
    enhancedEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  const { data: infra } = osrdEditoastApi.endpoints.getInfraById.useQuery(
    { id: infraId as number },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
    }
  );
  const [reloadInfra] = osrdEditoastApi.endpoints.postInfraByIdLoad.useMutation();

  const {
    updatePathSteps,
    // updatePowerRestrictionRanges,
    // updateAllowances,
  } = useOsrdConfActions();

  useEffect(() => {
    if (reloadCount <= 5 && infra && infra.state === 'TRANSIENT_ERROR') {
      setTimeout(() => {
        reloadInfra({ id: infraId as number }).unwrap();
        setReloadCount((count) => count + 1);
      }, 1000);
    }
  }, [infra, reloadCount]);

  useEffect(() => {
    if (infra) {
      switch (infra.state) {
        case 'NOT_LOADED': {
          reloadInfra({ id: infraId as number }).unwrap();
          setIsInfraLoaded(false);
          break;
        }
        case 'ERROR':
        case 'TRANSIENT_ERROR': {
          setIsInfraLoaded(true);
          break;
        }
        case 'CACHED': {
          setIsInfraLoaded(true);
          if (isInfraError) setIsInfraError(false);
          pathfindingDispatch({
            type: 'INFRA_CHANGED',
            params: {
              origin,
              destination,
              rollingStock,
            },
          });
          break;
        }
        default:
          break;
      }
    }
  }, [infra]);

  const generatePathfindingParams = (): PostV2InfraByInfraIdPathfindingBlocksApiArg | null => {
    setPathProperties(undefined);
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
    if (isInfraError) {
      reloadInfra({ id: infraId as number }).unwrap();
      setIsInfraLoaded(false);
    }
  }, [isInfraError]);

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

          if (pathfindingResult.status === 'success') {
            const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
              infraId,
              props: ['electrifications', 'geometry', 'operational_points'],
              pathPropertiesInput: {
                track_section_ranges: pathfindingResult.track_section_ranges,
              },
            };
            const { electrifications, geometry, operational_points } =
              await postPathProperties(pathPropertiesParams).unwrap();

            if (electrifications && geometry && operational_points) {
              const pathStepsWihPosition = compact(pathSteps).map((step, i) => ({
                ...step,
                positionOnPath: pathfindingResult.path_items_positions[i],
              }));
              dispatch(updatePathSteps(pathStepsWihPosition));

              const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
                operational_points,
                geometry,
                pathfindingResult.length
              );

              const updatedSuggestedOPs = insertViasInOPs(
                suggestedOperationalPoints,
                pathStepsWihPosition
              );

              setPathProperties({
                electrifications,
                geometry,
                suggestedOperationalPoints: updatedSuggestedOPs,
                length: pathfindingResult.length,
              });

              pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });

              // TODO TS2 : adapt this in margins and powerrestrictions issues
              // if (!isEmptyArray(powerRestrictions) || !isEmptyArray(allowances)) {
              //   dispatch(updatePowerRestrictionRanges([]));
              //   dispatch(updateAllowances([]));
              //   dispatch(
              //     setWarning({
              //       title: t('warningMessages.pathfindingChange'),
              //       text: t('warningMessages.marginsAndPowerRestrictionsReset'),
              //     })
              //   );
              // }
            }
          } else {
            pathfindingDispatch({ type: 'PATHFINDING_ERROR', message: pathfindingResult.status });
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

  const missingElements = conditionalStringConcat([
    [!origin, t('origin')],
    [!destination, t('destination')],
    [!rollingStock, t('rollingstock')],
  ]);

  const isPathFindingActive = Object.values(pathfindingState).every(
    (state) => state === false || state === ''
  );

  useEffect(() => setIsPathfindingInitialized(true), []);

  return (
    <div className="pathfinding-state-main-container flex-grow-1">
      {infra && infra.state !== 'CACHED' && (
        <div className="content infra-loading">
          <img src={infraLogo} alt="Infra logo" className="infra-logo" />
          <div>{t('infraLoading')}</div>
          <InfraLoadingState infra={infra} />
        </div>
      )}

      {infra && infra.state === 'TRANSIENT_ERROR' && <InfraSoftError reloadCount={reloadCount} />}

      {infra && infra.state === 'ERROR' && <InfraHardError />}

      {!pathfindingState.error &&
        !pathfindingState.running &&
        pathfindingState.done &&
        origin &&
        destination && (
          <div className="content pathfinding-done">
            <span className="lead" data-testid="result-pathfinding-done">
              <CheckCircle />
            </span>
            <span className="flex-grow-1">{t('pathfindingDone')}</span>
            <small className="text-secondary" data-testid="result-pathfinding-distance">
              {destination.positionOnPath &&
                formatKmValue(destination.positionOnPath, 'millimeters')}
            </small>
          </div>
        )}

      {!pathProperties && isPathFindingActive ? (
        <div
          className={cx('content pathfinding-none', { 'mt-2': infra && infra.state !== 'CACHED' })}
        >
          {t('pathfindingNoState')}
        </div>
      ) : (
        <>
          {pathfindingState.error && (
            <div
              className={cx('content pathfinding-error', {
                'mt-2': infra && infra.state !== 'CACHED',
              })}
            >
              <span className="lead">
                <Stop />
              </span>
              <span className="flex-grow-1">
                {t('pathfindingError', { errorMessage: t(pathfindingState.error) })}
              </span>
            </div>
          )}
          {pathfindingState.missingParam && (
            <div className="content missing-params">
              <span className="lead">
                <Alert />
              </span>
              <span className="flex-grow-1">
                {t('pathfindingMissingParams', { missingElements })}
              </span>
            </div>
          )}
          {pathfindingState.running && (
            <div className="content pathfinding-loading">
              <span className="lead">
                <Spinner />
              </span>
              <span className="flex-grow-1">{t('pathfindingInProgress')}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Pathfinding;
