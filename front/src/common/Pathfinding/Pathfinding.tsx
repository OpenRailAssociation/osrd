import React, { useState, useEffect, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import bbox from '@turf/bbox';
import { useTranslation } from 'react-i18next';
import { compact, isEqual } from 'lodash';
import { BiCheckCircle, BiXCircle, BiErrorCircle } from 'react-icons/bi';

import { getMapTrackSources } from 'reducers/map/selectors';
import { setFailure } from 'reducers/main';

import { ArrayElement } from 'utils/types';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';
import { lengthFromLineCoordinates } from 'utils/geometry';

import { Path, PathQuery, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { PointOnMap } from 'applications/operationalStudies/consts';

import {
  replaceVias,
  updateItinerary,
  updatePathfindingID,
  updateSuggeredVias,
} from 'reducers/osrdconf';
import {
  getInfraID,
  getOrigin,
  getDestination,
  getVias,
  getRollingStockID,
  getPathfindingID,
  getGeojson,
} from 'reducers/osrdconf/selectors';

import ModalPathJSONDetail from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalPathJSONDetail';
import infraLogo from 'assets/pictures/components/tracks.svg';
import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import { Spinner } from '../Loader';

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
      if (!action.params || state.running) {
        return state;
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
  mapTrackSources,
  origin,
  destination,
  rollingStockID,
}: {
  pathfindingID?: number;
  geojson?: Path;
  mapTrackSources: 'geographic' | 'schematic';
  origin?: PointOnMap;
  destination?: PointOnMap;
  rollingStockID?: number;
}): PathfindingState {
  if (!pathfindingID || !geojson?.[mapTrackSources]) {
    return {
      ...initialState,
      mustBeLaunched: Boolean(origin) && Boolean(destination) && Boolean(rollingStockID),
    };
  }
  return initialState;
}

interface PathfindingProps {
  mustUpdate?: boolean;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
}

export function getOpenApiSteps({
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
}): PathQuery | null {
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
      vias.map((via) =>
        via.location?.track_section && via.location?.offset && via.coordinates
          ? {
              duration: Math.round(via.duration || 0),
              waypoints: [
                via.location.offset !== undefined
                  ? {
                      track_section: via.location.track_section,
                      offset: via.location.offset,
                    }
                  : {
                      track_section: via.location.track_section,
                      geo_coordinate: via.coordinates,
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
        ...intermediateSteps,
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

function Pathfinding({ mustUpdate = true, zoomToFeature }: PathfindingProps) {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [pathfindingRequest, setPathfindingRequest] =
    useState<ReturnType<typeof postPathfinding>>();
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const infraID = useSelector(getInfraID, isEqual);
  const origin = useSelector(getOrigin, isEqual);
  const destination = useSelector(getDestination, isEqual);
  const vias = useSelector(getVias, isEqual);
  const rollingStockID = useSelector(getRollingStockID, isEqual);
  const pathfindingID = useSelector(getPathfindingID, isEqual);
  const geojson = useSelector(getGeojson, isEqual);
  const mapTrackSources = useSelector(getMapTrackSources, isEqual);
  const initializerArgs = {
    pathfindingID,
    geojson,
    mapTrackSources,
    origin,
    destination,
    rollingStockID,
  };
  const [pathfindingState, pathfindingDispatch] = useReducer(reducer, initializerArgs, init);
  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const [isInfraError, setIsInfraError] = useState(false);
  const [postPathfinding] = osrdEditoastApi.usePostPathfindingMutation();
  const { data: infra } = osrdEditoastApi.useGetInfraByIdQuery(
    { id: infraID as number },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
    }
  );
  const [reloadInfra] = osrdEditoastApi.usePostInfraByIdLoadMutation();

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
          pathfindingDispatch({
            type: 'INFRA_CHANGED',
            params: {
              vias,
              origin,
              destination,
              rollingStockID,
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
        <BiXCircle />
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
        <BiXCircle />
      </span>
      <span className="flex-grow-1">{t('errorMessages.hardErrorInfra')}</span>
    </div>
  );

  const transformVias = ({ steps }: Path) => {
    if (steps && steps.length >= 2) {
      const mapTrackSourcesType = mapTrackSources.substring(0, 3) as 'geo' | 'sch';
      const newVias = steps.slice(1, -1).flatMap((step: ArrayElement<Path['steps']>) => {
        const viaCoordinates = step[mapTrackSourcesType]?.coordinates;
        if (!step.suggestion && viaCoordinates) {
          return [{ ...step, coordinates: viaCoordinates }];
        }
        return [];
      });
      dispatch(replaceVias(newVias));
      dispatch(updateSuggeredVias(steps));
    }
  };

  const generatePathfindingParams = (): PathQuery | null => {
    dispatch(updateItinerary(undefined));
    return getOpenApiSteps({ infraID, rollingStockID, origin, destination, vias });
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

      const request = postPathfinding({ pathQuery: params });
      setPathfindingRequest(request);
      request
        .unwrap()
        .then((itineraryCreated: Path) => {
          transformVias(itineraryCreated);
          dispatch(updateItinerary(itineraryCreated));
          dispatch(updatePathfindingID(itineraryCreated.id));
          if (zoom) zoomToFeature(bbox(itineraryCreated[mapTrackSources]));
          pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });
        })
        .catch((e) => {
          if (e.error) {
            dispatch(
              setFailure({
                name: t('pathfinding'),
                message: e.error,
              })
            );
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
    if (geojson?.[mapTrackSources]) {
      zoomToFeature(bbox(geojson[mapTrackSources]));
    }
  }, []);

  useEffect(() => {
    if (mustUpdate) {
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
  }, [mustUpdate, vias]);

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
    if (mustUpdate) {
      pathfindingDispatch({
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
          rollingStockID,
        },
      });
    }
  }, [mustUpdate, origin, destination, rollingStockID]);

  const pathDetailsToggleButton = (
    <button
      type="button"
      onClick={() => openModal(<ModalPathJSONDetail />, 'lg')}
      className="btn btn-link details"
    >
      {formatKmValue(lengthFromLineCoordinates(geojson?.geographic?.coordinates))}
    </button>
  );

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

  return (
    <div className="pathfinding-state-main-container">
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

      {isPathFindingActive ? (
        <div className={`content pathfinding-none ${infra && infra.state !== 'CACHED' && 'mt-2'}`}>
          {t('pathfindingNoState')}
        </div>
      ) : (
        <>
          {pathfindingState.done && !pathfindingState.error && (
            <div className="content pathfinding-done">
              <span className="lead">
                <BiCheckCircle />
              </span>
              <span className="flex-grow-1">{t('pathfindingDone')}</span>
              {pathDetailsToggleButton}
            </div>
          )}
          {pathfindingState.error && (
            <div
              className={`content pathfinding-error ${infra && infra.state !== 'CACHED' && 'mt-2'}`}
            >
              <span className="lead">
                <BiXCircle />
              </span>
              <span className="flex-grow-1">
                {t('pathfindingError', { errorMessage: t(pathfindingState.error) })}
              </span>
            </div>
          )}
          {pathfindingState.missingParam && (
            <div className="content missing-params">
              <span className="lead">
                <BiErrorCircle />
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
}

export default Pathfinding;
