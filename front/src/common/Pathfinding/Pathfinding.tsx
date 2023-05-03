/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import bbox from '@turf/bbox';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import { BiCheckCircle, BiXCircle, BiErrorCircle } from 'react-icons/bi';

import { getMapTrackSources } from 'reducers/map/selectors';
import { setFailure } from 'reducers/main';

import { ArrayElement } from 'utils/types';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';
import { lengthFromLineCoordinates } from 'utils/geometry';

import { Path, PathQuery, osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
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
  getMaximumRunTime,
} from 'reducers/osrdconf/selectors';

import ModalPathJSONDetail from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalPathJSONDetail';
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
    case 'VIAS_CHANGED': {
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
}): PathQuery {
  return origin && destination && rollingStockID
    ? {
        infra: infraID,
        steps: [
          {
            duration: 0,
            waypoints: [
              {
                track_section: origin.id,
                geo_coordinate: origin.coordinates,
              },
            ],
          },
          ...vias.map((via) => ({
            duration: Math.round(via.duration || 0),
            waypoints: [
              {
                track_section: via.track || via.id,
                geo_coordinate: via.coordinates,
              },
            ],
          })),
          {
            duration: 1,
            waypoints: [
              {
                track_section: destination.id,
                geo_coordinate: destination.coordinates,
              },
            ],
          },
        ],
        rolling_stocks: [rollingStockID],
      }
    : {};
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
  const maximumRunTime = useSelector(getMaximumRunTime, isEqual);
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
  const [postPathfinding] = osrdMiddlewareApi.usePostPathfindingMutation();

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

  const generatePathfindingParams = (): PathQuery => {
    dispatch(updateItinerary(undefined));
    return getOpenApiSteps({ infraID, rollingStockID, origin, destination, vias });
  };

  const startPathFinding = (zoom = true) => {
    if (!pathfindingState.running) {
      pathfindingDispatch({ type: 'PATHFINDING_STARTED' });
      const params = generatePathfindingParams();
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
    if (pathfindingState.mustBeLaunched) {
      startPathFinding();
    }
  }, [pathfindingState.mustBeLaunched]);

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
    [!maximumRunTime, t('maximumRunTime')],
  ]);
  return (
    <div className="pathfinding-main-container">
      {pathfindingState.done && !pathfindingState.error && (
        <div className="pathfinding-done">
          <div className="title">
            <BiCheckCircle />
            {t('pathfindingDone')}
          </div>
          {pathDetailsToggleButton}
        </div>
      )}
      {pathfindingState.error && (
        <div className="pathfinding-error">
          <BiXCircle />
          {t('pathfindingError', { errorMessage: t(pathfindingState.error) })}
        </div>
      )}
      {pathfindingState.missingParam && (
        <div className="missing-params">
          <BiErrorCircle />
          {t('pathfindingMissingParams', { missingElements })}
        </div>
      )}
      {pathfindingState.running && loaderPathfindingInProgress}
    </div>
  );
}

export default Pathfinding;
