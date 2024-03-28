import React, { useState, useEffect, useReducer } from 'react';

import { Alert, CheckCircle, Stop } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { Position } from 'geojson';
import { compact, isEqual, omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import type { PointOnMap } from 'applications/operationalStudies/consts';
import infraLogo from 'assets/pictures/components/tracks.svg';
import type { PathResponse, PathfindingRequest, PathfindingStep } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Spinner } from 'common/Loaders';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { setFailure, setWarning } from 'reducers/main';
import { useAppDispatch } from 'store';
import { isEmptyArray } from 'utils/array';
import { castErrorToFailure } from 'utils/error';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';
import type { ArrayElement } from 'utils/types';

interface PathfindingState {
  running: boolean;
  done: boolean;
  error: string;
  missingParam: boolean;
  mustBeLaunched: boolean;
  mustBeLaunchedManually: boolean;
  cancelled: boolean;
}

export const initialState: PathfindingState = {
  running: false,
  done: false,
  error: '',
  missingParam: false,
  mustBeLaunched: false,
  mustBeLaunchedManually: false,
  cancelled: false,
};

interface Action {
  type: string;
  message?: string;
  params?: {
    origin?: Partial<PointOnMap>;
    destination?: Partial<PointOnMap>;
    rollingStockID?: number;
    vias?: Partial<PointOnMap>[];
    pathfindingId?: number;
  };
}

export function reducer(state: PathfindingState, action: Action): PathfindingState {
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
        (action.type === 'INFRA_CHANGED' && action.params.pathfindingId)
      ) {
        return { ...state };
      }
      const { origin, destination, rollingStockID } = action.params;
      if (!origin || !destination || !Number.isInteger(rollingStockID)) {
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
  pathfindingID,
  geojson,
  origin,
  destination,
  rollingStockID,
}: {
  pathfindingID?: number;
  geojson?: PathResponse;
  origin?: PointOnMap;
  destination?: PointOnMap;
  rollingStockID?: number;
}): PathfindingState {
  if (!pathfindingID || !geojson?.geographic) {
    return {
      ...initialState,
      mustBeLaunched: Boolean(origin) && Boolean(destination) && Boolean(rollingStockID),
    };
  }
  return initialState;
}

interface PathfindingProps {
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  path?: PathResponse;
}

export function getPathfindingQuery({
  infraID,
  rollingStockID,
  origin,
  destination,
  vias,
}: {
  infraID?: number;
  rollingStockID?: number;
  origin?: PointOnMap;
  destination?: PointOnMap;
  vias: PointOnMap[];
}): PathfindingRequest | null {
  if (
    origin &&
    destination &&
    rollingStockID &&
    origin.location?.track_section &&
    origin.coordinates &&
    infraID &&
    destination.location?.track_section &&
    destination.coordinates
  ) {
    const intermediateSteps = compact(
      vias.map(({ location, coordinates, duration: viaDuration }) =>
        location && location.track_section && (location.offset || coordinates)
          ? {
              duration: Math.round(viaDuration || 0),
              waypoints: [
                location.offset !== undefined
                  ? {
                      track_section: location.track_section,
                      offset: location.offset,
                    }
                  : {
                      track_section: location.track_section,
                      geo_coordinate: coordinates,
                    },
              ],
            }
          : null
      )
    );

    return {
      infra: infraID,
      steps: [
        {
          duration: 0,
          waypoints: [
            origin.location.offset !== undefined
              ? {
                  track_section: origin.location.track_section,
                  offset: origin.location.offset,
                }
              : {
                  track_section: origin.location.track_section,
                  geo_coordinate: origin.coordinates,
                },
          ],
        },
        ...(intermediateSteps as PathfindingStep[]),
        {
          duration: 1,
          waypoints: [
            destination.location.offset !== undefined
              ? {
                  track_section: destination.location.track_section,
                  offset: destination.location.offset,
                }
              : {
                  track_section: destination.location.track_section,
                  geo_coordinate: destination.coordinates,
                },
          ],
        },
      ],
      rolling_stocks: [rollingStockID],
    };
  }
  return null;
}

const Pathfinding = ({ zoomToFeature, path }: PathfindingProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [pathfindingRequest, setPathfindingRequest] =
    useState<ReturnType<typeof postPathfinding>>();
  const dispatch = useAppDispatch();
  const {
    getInfraID,
    getOrigin,
    getDestination,
    getVias,
    getRollingStockID,
    getPathfindingID,
    getGeojson,
    getPowerRestrictionRanges,
    getAllowances,
  } = useOsrdConfSelectors();
  const infraID = useSelector(getInfraID, isEqual);
  const origin = useSelector(getOrigin, isEqual);
  const destination = useSelector(getDestination, isEqual);
  const vias = useSelector(getVias, isEqual);
  const rollingStockID = useSelector(getRollingStockID, isEqual);
  const pathfindingID = useSelector(getPathfindingID, isEqual);
  const geojson = useSelector(getGeojson, isEqual);
  const powerRestrictions = useSelector(getPowerRestrictionRanges, isEqual);
  const allowances = useSelector(getAllowances, isEqual);
  const initializerArgs = {
    pathfindingID,
    geojson,
    origin,
    destination,
    rollingStockID,
  };
  const [pathfindingState, pathfindingDispatch] = useReducer(reducer, initializerArgs, init);
  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const [isInfraError, setIsInfraError] = useState(false);

  const [isPathfindingInitialized, setIsPathfindingInitialized] = useState(false);

  const [postPathfinding] = osrdEditoastApi.endpoints.postPathfinding.useMutation();

  const { data: infra } = osrdEditoastApi.endpoints.getInfraById.useQuery(
    { id: infraID as number },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
    }
  );
  const [reloadInfra] = osrdEditoastApi.endpoints.postInfraByIdLoad.useMutation();

  const {
    replaceVias,
    updateItinerary,
    updatePathfindingID,
    updateSuggeredVias,
    updatePowerRestrictionRanges,
    updateAllowances,
  } = useOsrdConfActions();

  useEffect(() => {
    if (reloadCount <= 5 && infra && infra.state === 'TRANSIENT_ERROR') {
      setTimeout(() => {
        reloadInfra({ id: infraID as number }).unwrap();
        setReloadCount((count) => count + 1);
      }, 1000);
    }
  }, [infra, reloadCount]);

  useEffect(() => {
    if (infra) {
      switch (infra.state) {
        case 'NOT_LOADED': {
          reloadInfra({ id: infraID as number }).unwrap();
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
              vias,
              origin,
              destination,
              rollingStockID,
              pathfindingId: pathfindingID,
            },
          });
          break;
        }
        default:
          break;
      }
    }
  }, [infra]);

  const displayInfraSoftError = () => (
    <div className="content pathfinding-error my-2">
      <span className="lead">
        <Stop />
      </span>
      {reloadCount <= 5 ? (
        <span className="flex-grow-1">{t('errorMessages.unableToLoadInfra', { reloadCount })}</span>
      ) : (
        <span className="flex-grow-1">{t('errorMessages.softErrorInfra')}</span>
      )}
    </div>
  );

  const displayInfraHardError = () => (
    <div className="content pathfinding-error my-2">
      <span className="lead">
        <Stop />
      </span>
      <span className="flex-grow-1">{t('errorMessages.hardErrorInfra')}</span>
    </div>
  );

  const transformVias = ({ steps }: PathResponse) => {
    if (steps && steps.length >= 2) {
      const stepsAsPointOnMap: PointOnMap[] = steps.map((step) => ({
        ...omit(step, ['geo']),
        coordinates: step.geo?.coordinates,
        id: step.id || undefined,
        name: step.name || undefined,
      }));
      const newVias = steps.slice(1, -1).flatMap((step: ArrayElement<PathResponse['steps']>) => {
        const viaCoordinates = step.geo?.coordinates;
        if (!step.suggestion && viaCoordinates) {
          return [
            {
              ...omit(step, ['geo']),
              coordinates: viaCoordinates,
              id: step.id || undefined,
              name: step.name || undefined,
            },
          ];
        }
        return [];
      });
      dispatch(replaceVias(newVias));
      dispatch(updateSuggeredVias(stepsAsPointOnMap));
    }
  };

  const generatePathfindingParams = (): PathfindingRequest | null => {
    dispatch(updateItinerary(undefined));
    return getPathfindingQuery({ infraID, rollingStockID, origin, destination, vias });
  };

  const startPathFinding = (zoom = true) => {
    if (!pathfindingState.running) {
      pathfindingDispatch({ type: 'PATHFINDING_STARTED' });
      const params = generatePathfindingParams();
      if (!params) {
        dispatch(
          setFailure({
            name: t('pathfinding'),
            message: t('pathfindingMissingParamsSimple'),
          })
        );
        return;
      }

      const request = postPathfinding({ pathfindingRequest: params });
      setPathfindingRequest(request);
      request
        .unwrap()
        .then((itineraryCreated: PathResponse) => {
          transformVias(itineraryCreated);
          dispatch(updateItinerary(itineraryCreated));
          dispatch(updatePathfindingID(itineraryCreated.id));
          if (zoom) zoomToFeature(bbox(itineraryCreated.geographic));
          pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });

          if (!isEmptyArray(powerRestrictions) || !isEmptyArray(allowances)) {
            dispatch(updatePowerRestrictionRanges([]));
            dispatch(updateAllowances([]));
            dispatch(
              setWarning({
                title: t('warningMessages.pathfindingChange'),
                text: t('warningMessages.marginsAndPowerRestrictionsReset'),
              })
            );
          }
        })
        .catch((e) => {
          if (e.error) {
            dispatch(setFailure(castErrorToFailure(e, { name: t('pathfinding') })));
            pathfindingDispatch({ type: 'PATHFINDING_ERROR', message: 'failedRequest' });
          } else if (e?.data?.message) {
            pathfindingDispatch({ type: 'PATHFINDING_ERROR', message: e.data.message });
            if (e.data.message === 'Infra not loaded' || e.data.message === 'Invalid version') {
              setIsInfraError(true);
            }
          }
          dispatch(updatePathfindingID(undefined));
        });
    }
  };

  useEffect(() => {
    if (geojson?.geographic) {
      zoomToFeature(bbox(geojson.geographic));
    }
  }, []);

  useEffect(() => {
    if (isPathfindingInitialized) {
      pathfindingDispatch({
        type: 'VIAS_CHANGED',
        params: {
          vias,
          origin,
          destination,
          rollingStockID,
        },
      });
    }
  }, [vias]);

  useEffect(() => {
    if (isInfraError) {
      reloadInfra({ id: infraID as number }).unwrap();
      setIsInfraLoaded(false);
    }
  }, [isInfraError]);

  useEffect(() => {
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
          vias,
          rollingStockID,
        },
      });
    }
  }, [origin, destination, rollingStockID]);

  const loaderPathfindingInProgress = (
    <div className="pathfinding-in-progress">
      <div className="pathfinding-in-progress-card">
        <div className="pathfinding-in-progress-title-container">
          <Spinner />
          <h2 className="pathfinding-in-progress-title">{t('pathfindingInProgress')}</h2>
        </div>
        <button
          className="btn btn-sm btn-primary"
          type="button"
          onClick={() => {
            pathfindingRequest?.abort();
            pathfindingDispatch({ type: 'PATHFINDING_CANCELLED' });
          }}
        >
          {t('cancelPathfinding')}
        </button>
      </div>
    </div>
  );

  const missingElements = conditionalStringConcat([
    [!origin, t('origin')],
    [!destination, t('destination')],
    [!rollingStockID, t('rollingstock')],
  ]);

  const isPathFindingActive = Object.values(pathfindingState).every(
    (state) => state === false || state === ''
  );

  useEffect(() => setIsPathfindingInitialized(true), []);

  return (
    <div className="pathfinding-state-main-container flex-grow-1">
      {infra && infra.state !== 'CACHED' && (
        <div className="content infra-loading">
          <img src={infraLogo} alt="Infra logo" className="mr-2" />
          <div>{t('infraLoading')}</div>
          <InfraLoadingState infra={infra} />
        </div>
      )}

      {infra &&
        (infra.state === 'TRANSIENT_ERROR'
          ? displayInfraSoftError()
          : infra.state === 'ERROR' && displayInfraHardError())}

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
              {geojson?.length && formatKmValue(geojson?.length / 1000, 3)}
            </small>
          </div>
        )}

      {!path && isPathFindingActive ? (
        <div className={`content pathfinding-none ${infra && infra.state !== 'CACHED' && 'mt-2'}`}>
          {t('pathfindingNoState')}
        </div>
      ) : (
        <>
          {pathfindingState.error && (
            <div
              className={`content pathfinding-error ${infra && infra.state !== 'CACHED' && 'mt-2'}`}
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
          {pathfindingState.running && loaderPathfindingInProgress}
        </>
      )}
    </div>
  );
};

export default Pathfinding;
