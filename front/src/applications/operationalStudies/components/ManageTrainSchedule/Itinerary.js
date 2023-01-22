import React, { useEffect, useState } from 'react';
import {
  replaceVias,
  updateDestination,
  updateItinerary,
  updateOrigin,
  updatePathfindingID,
  updateSuggeredVias,
} from 'reducers/osrdconf';
import { useDispatch, useSelector } from 'react-redux';

import DisplayItinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';
import ModalPathJSONDetail from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalPathJSONDetail';
import PropTypes from 'prop-types';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { WebMercatorViewport } from 'viewport-mercator-project';
import bbox from '@turf/bbox';
import { post } from 'common/requests';
import { setFailure } from 'reducers/main';
import { updateFeatureInfoClick } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import { getInfraID } from 'reducers/osrdconf/selectors';

const itineraryURI = '/pathfinding/';

function Itinerary(props) {
  const [launchPathfinding, setLaunchPathfinding] = useState(false);
  const [pathfindingInProgress, setPathfindingInProgress] = useState(false);
  const { vias } = useSelector((state) => state.osrdconf);
  const { updateExtViewport } = props;
  const dispatch = useDispatch();
  const map = useSelector((state) => state.map);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const infra = useSelector(getInfraID);

  const zoomToFeature = (boundingBox, id = undefined, source = undefined) => {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;

    const viewport = new WebMercatorViewport({ ...map.viewport, width: 600, height: 400 });

    const { longitude, latitude, zoom } = viewport.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 40,
      }
    );
    const newViewport = {
      ...map.viewport,
      longitude,
      latitude,
      zoom,
    };
    updateExtViewport(newViewport);
    if (id !== undefined && source !== undefined) {
      updateFeatureInfoClick(Number(id), source);
    }
  };

  const zoomToFeaturePoint = (lngLat, id = undefined, source = undefined) => {
    if (lngLat) {
      const newViewport = {
        ...map.viewport,
        longitude: lngLat[0],
        latitude: lngLat[1],
        zoom: 16,
      };
      updateExtViewport(newViewport);
      if (id !== undefined && source !== undefined) {
        updateFeatureInfoClick(Number(id), source);
      }
    }
  };

  // Obtain only asked vias
  const convertPathfindingVias = (steps, idxToAdd) => {
    const count = steps.length - 1;
    const newVias = [];
    steps.forEach((step, idx) => {
      if (idx !== 0 && idx !== count && (!step.suggestion || idxToAdd === idx)) {
        newVias.push({
          ...step,
          id: step.position,
          clickLngLat: [
            step[map.mapTrackSources.substr(0, 3)].coordinates[0],
            step[map.mapTrackSources.substr(0, 3)].coordinates[1],
          ],
        });
      }
    });
    dispatch(replaceVias(newVias));
    dispatch(updateSuggeredVias(steps));
  };

  const removeViaFromPath = (step) => {
    dispatch(replaceVias(vias.filter((via) => via.track !== step.track)));
  };

  // Way to ensure marker position on track
  const correctWaypointsGPS = (pathfindingData) => {
    setLaunchPathfinding(false);
    dispatch(
      updateOrigin({
        ...osrdconf.origin,
        clickLngLat: pathfindingData.steps[0][map.mapTrackSources.substr(0, 3)].coordinates,
      })
    );

    if (osrdconf.vias.length > 0 || pathfindingData.steps.length > 2) {
      convertPathfindingVias(pathfindingData.steps);
    }

    dispatch(
      updateDestination({
        ...osrdconf.destination,
        clickLngLat:
          pathfindingData.steps[pathfindingData.steps.length - 1][map.mapTrackSources.substr(0, 3)]
            .coordinates,
      })
    );
    setLaunchPathfinding(true);
  };

  const postPathFinding = async (zoom, params) => {
    try {
      setPathfindingInProgress(true);
      const itineraryCreated = await post(itineraryURI, params, {}, true);
      correctWaypointsGPS(itineraryCreated);
      dispatch(updateItinerary(itineraryCreated));
      dispatch(updatePathfindingID(itineraryCreated.id));
      if (zoom) zoomToFeature(bbox(itineraryCreated[map.mapTrackSources]));
      setPathfindingInProgress(false);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrievePathfinding'),
          message: `${e.message} : ${e.response && e.response.data.detail}`,
        })
      );
      console.log('ERROR', e);
    }
  };

  const mapItinerary = (zoom = true) => {
    dispatch(updateItinerary(undefined));

    if (
      osrdconf.origin !== undefined &&
      osrdconf.destination !== undefined &&
      osrdconf.rollingStockID !== undefined
    ) {
      const params = {
        infra: osrdconf.infraID,
        steps: [],
        rolling_stocks: [osrdconf.rollingStockID],
      };

      // Adding start point
      params.steps.push({
        duration: 0,
        waypoints: [
          {
            track_section: osrdconf.origin.id,
            geo_coordinate: osrdconf.origin.clickLngLat,
          },
        ],
      });

      // Adding via points if exist
      if (osrdconf.vias.length > 0) {
        osrdconf.vias.forEach((via) => {
          params.steps.push({
            duration: via.duration === undefined ? 0 : parseInt(via.duration, 10),
            waypoints: [
              {
                track_section: via.track || via.id,
                geo_coordinate: via.clickLngLat,
              },
            ],
          });
        });
      }

      // Adding end point
      params.steps.push({
        duration: 1,
        waypoints: [
          {
            track_section: osrdconf.destination.id,
            geo_coordinate: osrdconf.destination.clickLngLat,
          },
        ],
      });

      postPathFinding(zoom, params);
    }
  };

  const inverseOD = () => {
    if (osrdconf.origin && osrdconf.destination) {
      const origin = { ...osrdconf.origin };
      dispatch(updateOrigin(osrdconf.destination));
      dispatch(updateDestination(origin));
      if (osrdconf.vias && osrdconf.vias.length > 1) {
        const newVias = Array.from(osrdconf.vias);
        dispatch(replaceVias(newVias.reverse()));
      }
      setLaunchPathfinding(true);
    }
  };

  const removeAllVias = () => {
    dispatch(replaceVias([]));
    setLaunchPathfinding(true);
  };

  useEffect(() => {
    if (
      osrdconf?.pathfindingID === undefined ||
      osrdconf?.geojson?.[map?.mapTrackSources] === undefined
    ) {
      mapItinerary();
    } else {
      zoomToFeature(bbox(osrdconf.geojson[map.mapTrackSources]));
    }
    setLaunchPathfinding(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (launchPathfinding) {
      mapItinerary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osrdconf.origin, osrdconf.destination, map.mapTrackSources, osrdconf.rollingStockID]);

  useEffect(() => {
    if (launchPathfinding) {
      mapItinerary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osrdconf.vias]);

  useEffect(() => {
    setPathfindingInProgress(false);
  }, [infra]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div className="osrd-config-item-container" data-testid="itinerary">
          <DisplayItinerary
            data-testid="display-itinerary"
            zoomToFeaturePoint={zoomToFeaturePoint}
          />
          {pathfindingInProgress && (
            <div className="osrd-config-centered-item">
              <DotsLoader /> {`${t('pathFindingInProgress')}`}
            </div>
          )}
        </div>
      </div>
      <ModalSugerredVias
        convertPathfindingVias={convertPathfindingVias}
        inverseOD={inverseOD}
        removeAllVias={removeAllVias}
        pathfindingInProgress={pathfindingInProgress}
        removeViaFromPath={removeViaFromPath}
      />
      <ModalPathJSONDetail pathfindingInProgress={pathfindingInProgress} />
    </>
  );
}

Itinerary.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};

export default Itinerary;
