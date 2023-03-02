/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useReducer, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import bbox from '@turf/bbox';
import { useTranslation } from 'react-i18next';
import { last, isEqual } from 'lodash';
import { BiCheckCircle, BiXCircle, BiErrorCircle } from 'react-icons/bi';

import { getMapTrackSources } from 'reducers/map/selectors';
import { setFailure } from 'reducers/main';

import { ArrayElement, ValueOf } from 'utils/types';
import { adjustPointOnTrack } from 'utils/pathfinding';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';
import { lengthFromLineCoordinates } from 'utils/geometry';

import { Path, PathQuery, osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { MODES, PointOnMap } from 'applications/operationalStudies/consts';

import {
  replaceVias as replaceViasStdcm,
  updateDestination as updateDestinationStdcm,
  updateItinerary as updateItineraryStdcm,
  updateOrigin as updateOriginStdcm,
  updateSuggeredVias as updateSuggeredViasStdcm,
} from 'reducers/osrdStdcmConf';

import {
  replaceVias,
  updateDestination,
  updateItinerary,
  updateOrigin,
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

import {
  getOrigin as getOriginStdcm,
  getDestination as getDestinationStdcm,
  getVias as getViasStdcm,
  getGeojson as getGeoJsonStdcm,
} from 'reducers/osrdStdcmConf/selectors';

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

export function init({
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
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  mode?: ValueOf<typeof MODES>;
}

function Pathfinding({ zoomToFeature, mode }: PathfindingProps) {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [pathfindingRequest, setPathfindingRequest] = useState<any>();
  const { openModal } = useContext(ModalContext);
  const dispatch = useDispatch();
  const infraID = useSelector(getInfraID, isEqual);
  const origin = useSelector(mode === MODES.stdcm ? getOriginStdcm : getOrigin, isEqual);
  const destination = useSelector(
    mode === MODES.stdcm ? getDestinationStdcm : getDestination,
    isEqual
  );
  const vias = useSelector(mode === MODES.stdcm ? getViasStdcm : getVias, isEqual);
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

  const openModalWrapperBecauseTypescriptSucks = () => {
    openModal(<ModalPathJSONDetail pathfindingID={pathfindingID} />, 'lg');
  };
 

  // Way to ensure marker position on track
  const correctWaypointsGPS = ({ steps = [] }: Path) => {
    const updateOriginMethod = MODES.stdcm ? updateOriginStdcm : updateOrigin;
    dispatch(updateOriginMethod(adjustPointOnTrack(origin, steps[0], mapTrackSources)));
    if (vias.length > 0 || steps.length > 2) {
      const newVias = steps.slice(1, -1).flatMap((step: ArrayElement<Path['steps']>) => {
        if (!step.suggestion) {
          return [adjustPointOnTrack(step, step, mapTrackSources, step.position)];
        }
        return [];
      });
      dispatch(mode === MODES.stdcm ? replaceViasStdcm(newVias) : replaceVias(newVias));
      dispatch(mode === MODES.stdcm ? updateSuggeredViasStdcm(steps) : updateSuggeredVias(steps));
    }
    const updateDestinationMethod = MODES.stdcm ? updateDestinationStdcm : updateDestination;
    dispatch(
      updateDestinationMethod(adjustPointOnTrack(destination, last(steps), mapTrackSources))
    );
  };

  const generatePathfindingParams = (): PathQuery => {
    dispatch(mode === MODES.stdcm ? updateItineraryStdcm(undefined) : updateItinerary(undefined));
    if (origin && destination && rollingStockID) {
      return {
        infra: infraID,
        steps: [
          {
            duration: 0,
            waypoints: [
              {
                track_section: origin.id,
                geo_coordinate: origin.clickLngLat,
              },
            ],
          },
          ...vias.map((via) => ({
            duration: Math.round(via.duration || 0),
            waypoints: [
              {
                track_section: via.track || via.id,
                geo_coordinate: via.clickLngLat,
              },
            ],
          })),
          {
            duration: 1,
            waypoints: [
              {
                track_section: destination.id,
                geo_coordinate: destination.clickLngLat,
              },
            ],
          },
        ],
        rolling_stocks: [rollingStockID],
      };
    }
    return {};
  };

  const startPathFinding = (zoom = true) => {
    if (!pathfindingState.running) {
      pathfindingDispatch({ type: 'PATHFINDING_STARTED' });
      const params = generatePathfindingParams();
      const request = postPathfinding({ pathQuery: params });
      setPathfindingRequest(request);
      request
        .unwrap()
        .then((itineraryCreated) => {
          correctWaypointsGPS(itineraryCreated);
          dispatch(
            mode === MODES.stdcm
              ? updateItineraryStdcm(itineraryCreated)
              : updateItinerary(itineraryCreated)
          );
          dispatch(updatePathfindingID(itineraryCreated.id));
          if (zoom) zoomToFeature(bbox(itineraryCreated[mapTrackSources]));
          pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });
        })
        .catch((e: any) => {
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
        });
    }
  };

  useEffect(() => {
    if (geojson?.[mapTrackSources]) {
      zoomToFeature(bbox(geojson[mapTrackSources]));
    }
  }, []);

  useEffect(() => {
    pathfindingDispatch({
      type: 'VIAS_CHANGED',
      params: {
        vias,
        origin,
        destination,
        rollingStockID,
      },
    });
  }, [vias]);

  useEffect(() => {
    if (pathfindingState.mustBeLaunched) {
      startPathFinding();
    }
  }, [pathfindingState.mustBeLaunched]);

  useEffect(() => {
    pathfindingDispatch({
      type: 'PATHFINDING_PARAM_CHANGED',
      params: {
        origin,
        destination,
        rollingStockID,
      },
    });
  }, [origin, destination, rollingStockID]);

  const pathDetailsToggleButton = (
    <button
      type="button"
      onClick={openModalWrapperBecauseTypescriptSucks}
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
