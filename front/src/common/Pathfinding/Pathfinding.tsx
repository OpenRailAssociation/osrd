/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useReducer, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import bbox from '@turf/bbox';
import { useTranslation } from 'react-i18next';
import { last, isEmpty, isEqual } from 'lodash';
import { BiCheckCircle, BiXCircle, BiErrorCircle } from 'react-icons/bi';

import { ArrayElement } from 'utils/types';
import { Path, PathQuery, osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { adjustPointOnTrack } from 'utils/pathfinding';
import { conditionalStringConcat } from 'utils/strings';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { PointOnMap } from 'applications/operationalStudies/consts';

import { getMapTrackSources } from 'reducers/map/selectors';

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

import ModalPathJSONDetail from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalPathJSONDetail';
import './pathfinding.scss';

interface PathfindingState {
  running: boolean;
  done: boolean;
  error: string;
  missingParam: boolean;
  mustBeLaunched: boolean;
  mustBeLaunchedManually: boolean;
}

export const initialState: PathfindingState = {
  running: false,
  done: false,
  error: '',
  missingParam: false,
  mustBeLaunched: false,
  mustBeLaunchedManually: false,
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
      };
    }
    case 'PATHFINDING_FINISHED': {
      return {
        ...state,
        running: false,
        done: true,
        error: '',
        mustBeLaunched: false,
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
    case 'PATHFINDING_PARAM_CHANGED': {
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
    case 'VIAS_CHANGED': {
      if (!action.params || isEmpty(action.params.vias)) {
        return state;
      }
      return {
        ...state,
        mustBeLaunchedManually: true,
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
}: {
  pathfindingID?: number;
  geojson?: Path;
  mapTrackSources: 'geographic' | 'schematic';
}): PathfindingState {
  if (!pathfindingID || !geojson?.[mapTrackSources]) {
    return {
      ...initialState,
      mustBeLaunched: true,
    };
  }
  return initialState;
}

interface PathfindingProps {
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
}

function Pathfinding({ zoomToFeature }: PathfindingProps) {
  const { t } = useTranslation(['osrdconf']);
  const { openModal } = useContext(ModalContext);
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
  };
  const [pathfindingState, pathfindingDispatch] = useReducer(reducer, initializerArgs, init);
  const [postPathfinding] = osrdMiddlewareApi.usePostPathfindingMutation();

  const openModalWrapperBecauseTypescriptSucks = () => {
    openModal(<ModalPathJSONDetail />, 'lg');
  };

  // Way to ensure marker position on track
  const correctWaypointsGPS = ({ steps = [] }: Path) => {
    dispatch(updateOrigin(adjustPointOnTrack(origin, steps[0], mapTrackSources)));
    if (vias.length > 0 || steps.length > 2) {
      const newVias = steps.slice(1, -1).flatMap((step: ArrayElement<Path['steps']>) => {
        if (!step.suggestion) {
          return [adjustPointOnTrack(step, step, mapTrackSources, step.position)];
        }
        return [];
      });
      dispatch(replaceVias(newVias));
      dispatch(updateSuggeredVias(steps));
    }
    dispatch(updateDestination(adjustPointOnTrack(destination, last(steps), mapTrackSources)));
  };

  const generatePathfindingParams = (): PathQuery => {
    dispatch(updateItinerary(undefined));
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

  const startPathFinding = async (zoom = true) => {
    if (!pathfindingState.running) {
      try {
        pathfindingDispatch({ type: 'PATHFINDING_STARTED' });
        const params = generatePathfindingParams();
        const itineraryCreated = await postPathfinding({ pathQuery: params }).unwrap();
        correctWaypointsGPS(itineraryCreated);
        dispatch(updateItinerary(itineraryCreated));
        dispatch(updatePathfindingID(itineraryCreated.id));
        if (zoom) zoomToFeature(bbox(itineraryCreated[mapTrackSources]));
        pathfindingDispatch({ type: 'PATHFINDING_FINISHED' });
      } catch (e: any) {
        pathfindingDispatch({ type: 'PATHFINDING_ERROR', message: e.data.message });
      }
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
      },
    });
  }, [vias]);

  useEffect(() => {
    startPathFinding();
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
    <button type="button" onClick={openModalWrapperBecauseTypescriptSucks} className="btn btn-link">
      <small className="ml-1">{pathfindingID}</small>
    </button>
  );

  const loaderPathfindingInProgress = (
    <div className="loader-pathfinding-in-progress">
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
      {t('pathfindingInProgress')}
    </div>
  );

  return (
    <div className="pathfinding-main-container">
      {pathfindingState.done && !pathfindingState.error && (
        <div className="pathfinding-done">
          <BiCheckCircle />
          {t('pathfindingDone')}
          {pathDetailsToggleButton}
        </div>
      )}
      {pathfindingState.error && (
        <div className="pathfinding-error">
          <BiXCircle />
          {t('pathfindingError')} {t(pathfindingState.error)}
        </div>
      )}
      {pathfindingState.missingParam && (
        <div className="missing-params">
          <BiErrorCircle />
          {t('pathfindingMissingParams')}
          {conditionalStringConcat([
            [!origin, t('origin')],
            [!destination, t('destination')],
            [!rollingStockID, t('rollingstock')],
          ])}
        </div>
      )}
      {pathfindingState.running && loaderPathfindingInProgress}
    </div>
  );
}

export default Pathfinding;
