/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import bbox from '@turf/bbox';
import { useTranslation } from 'react-i18next';
import { last } from 'lodash';

import { ArrayElement } from 'utils/types';
import { Path, PathQuery, osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { adjustPointOnTrack } from 'utils/pathfinding';

import { getMapTrackSources } from 'reducers/map/selectors';
import { setFailure } from 'reducers/main';

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

import DotsLoader from 'common/DotsLoader/DotsLoader';

function LoaderPathfindingInProgress() {
  return (
    <div className="loaderPathfindingInProgress">
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

interface PathfindingProps {
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
}

function Pathfinding({ zoomToFeature }: PathfindingProps) {
  const { t } = useTranslation(['osrdconf']);
  const dispatch = useDispatch();
  const [launchPathfinding, setLaunchPathfinding] = useState(false);
  const [pathfindingInProgress, setPathfindingInProgress] = useState(false);
  const infraID = useSelector(getInfraID);
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const vias = useSelector(getVias);
  const rollingStockID = useSelector(getRollingStockID);
  const pathfindingID = useSelector(getPathfindingID);
  const geojson = useSelector(getGeojson);
  const mapTrackSources = useSelector(getMapTrackSources);

  // Way to ensure marker position on track
  const correctWaypointsGPS = ({ steps = [] }: Path) => {
    setLaunchPathfinding(false);
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
    setLaunchPathfinding(true);
  };

  const mapItinerary = (zoom = true) => {
    dispatch(updateItinerary(undefined));

    if (origin && destination && rollingStockID) {
      const params: PathQuery = {
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
      createPathFinding(zoom, params);
    }
  };

  const createPathFinding = async (zoom: boolean, params: PathQuery) => {
    try {
      setPathfindingInProgress(true);
      const itineraryCreated = await PathfindingApi.create(params);
      correctWaypointsGPS(itineraryCreated);
      dispatch(updateItinerary(itineraryCreated));
      dispatch(updatePathfindingID(itineraryCreated.id));
      if (zoom) zoomToFeature(bbox(itineraryCreated[mapTrackSources]));
      setPathfindingInProgress(false);
    } catch (e: any) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrievePathfinding'),
          message: `${e.message} : ${e.response && e.response.data.detail}`,
        })
      );
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    const index = Number(mapTrackSources);
    if (!pathfindingID || !geojson?.[index]) {
      mapItinerary();
    } else {
      zoomToFeature(bbox(geojson[index]));
    }
    setLaunchPathfinding(true);
  }, []);

  useEffect(() => {
    if (launchPathfinding) {
      mapItinerary();
    }
  }, [origin, destination, mapTrackSources, rollingStockID]);

  useEffect(() => {
    if (launchPathfinding) {
      mapItinerary(false);
    }
  }, [vias]);
  return (
    <div>
      {pathfindingInProgress && (
        <div className="osrd-config-centered-item">
          <DotsLoader /> {`${t('pathFindingInProgress')}`}
        </div>
      )}
    </div>
  );
}

export default Pathfinding;
