import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { setFailure } from 'reducers/main.ts';
import {
  updateItinerary, updatePathfindingID, updateOrigin,
  updateDestination, replaceVias, updateSuggeredVias,
} from 'reducers/osrdconf';
import { updateFeatureInfoClick } from 'reducers/map';
import { post } from 'common/requests';
import bbox from '@turf/bbox';
import { WebMercatorViewport } from 'react-map-gl';
import DisplayItinerary from 'applications/osrd/components/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/osrd/components/Itinerary/ModalSuggeredVias';

const itineraryURI = '/pathfinding/';

// Obtain only asked vias
const convertPathfindingVias = (steps, dispatch, idxToAdd) => {
  const count = steps.length - 1;
  const vias = [];
  steps.forEach((step, idx) => {
    if (idx !== 0 && idx !== count && (!step.suggestion || idxToAdd === idx)) {
      vias.push({
        ...step,
        id: step.track.id,
        clickLngLat: [step.geo.coordinates[0], step.geo.coordinates[1]],
      });
    }
  });
  dispatch(replaceVias(vias));
  dispatch(updateSuggeredVias(steps));
};

const Itinerary = (props) => {
  const [launchPathfinding, setLaunchPathfinding] = useState(false);
  const [pathfindingInProgress, setPathfindingInProgress] = useState(false);
  const { updateExtViewport } = props;
  const dispatch = useDispatch();
  const map = useSelector((state) => state.map);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['osrdconf']);

  const zoomToFeature = (boundingBox, id = undefined, source = undefined) => {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;

    const viewport = new WebMercatorViewport({ ...map.viewport, width: 600, height: 400 });

    const { longitude, latitude, zoom } = viewport.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: 40,
    });
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
  };

  // Way to ensure marker position on track
  const correctWaypointsGPS = (pathfindingData) => {
    setLaunchPathfinding(false);
    dispatch(updateOrigin({
      ...osrdconf.origin, clickLngLat: pathfindingData.steps[0].geo.coordinates,
    }));

    if (osrdconf.vias.length > 0 || pathfindingData.steps.length > 2) {
      convertPathfindingVias(pathfindingData.steps, dispatch);
    }

    dispatch(updateDestination({
      ...osrdconf.destination,
      clickLngLat: pathfindingData.steps[pathfindingData.steps.length - 1].geo.coordinates,
    }));
    setLaunchPathfinding(true);
  };

  const postPathFinding = async (zoom, params) => {
    try {
      setPathfindingInProgress(true);
      const itineraryCreated = await post(itineraryURI, params, {}, true);
      correctWaypointsGPS(itineraryCreated);
      dispatch(updateItinerary(itineraryCreated.geographic));
      dispatch(updatePathfindingID(itineraryCreated.id));
      if (zoom) zoomToFeature(bbox(itineraryCreated.geographic));
      setPathfindingInProgress(false);
    } catch (e) {
      dispatch(setFailure({
        name: t('errorMessages.unableToRetrievePathfinding'),
        message: `${e.message} : ${e.response && e.response.data.detail}`,
      }));
      console.log('ERROR', e);
    }
  };

  const mapItinerary = (zoom = true) => {
    dispatch(updateItinerary(undefined));

    if (osrdconf.origin !== undefined && osrdconf.destination !== undefined) {
      const params = {
        infra: osrdconf.infraID,
        steps: [],
      };

      // Adding start point
      params.steps.push({
        duration: 0,
        waypoints: [{
          track_section: osrdconf.origin.id,
          geo_coordinate: osrdconf.origin.clickLngLat,
        }],
      });

      // Adding via points if exist
      if (osrdconf.vias.length > 0) {
        osrdconf.vias.forEach((via) => {
          params.steps.push({
            duration: via.duration === undefined ? 0 : parseInt(via.duration, 10),
            waypoints: [{
              track_section: via.id,
              geo_coordinate: via.clickLngLat,
            }],
          });
        });
      }

      // Adding end point
      params.steps.push({
        duration: 1,
        waypoints: [{
          track_section: osrdconf.destination.id,
          geo_coordinate: osrdconf.destination.clickLngLat,
        }],
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
        const vias = Array.from(osrdconf.vias);
        dispatch(replaceVias(vias.reverse()));
      }
      setLaunchPathfinding(true);
    }
  };

  const removeAllVias = () => {
    dispatch(replaceVias([]));
    setLaunchPathfinding(true);
  };

  useEffect(() => {
    if (osrdconf.pathfindingID === undefined || osrdconf.geojson === undefined) {
      mapItinerary();
    } else {
      zoomToFeature(bbox(osrdconf.geojson));
    }
    setLaunchPathfinding(true);
  }, []);

  useEffect(() => {
    if (launchPathfinding) {
      mapItinerary();
    }
  }, [osrdconf.origin, osrdconf.destination, map.mapTrackSources]);

  useEffect(() => {
    if (launchPathfinding) {
      mapItinerary(false);
    }
  }, [osrdconf.vias]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div className="osrd-config-item-container">
          <DisplayItinerary zoomToFeaturePoint={zoomToFeaturePoint} />
        </div>
      </div>
      <ModalSugerredVias
        convertPathfindingVias={convertPathfindingVias}
        inverseOD={inverseOD}
        removeAllVias={removeAllVias}
        pathfindingInProgress={pathfindingInProgress}
      />
    </>
  );
};

Itinerary.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};

export default Itinerary;
