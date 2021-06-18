import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateItinerary, updatePathfindingID, updateOrigin, updateDestination, replaceVias,
} from 'reducers/osrdconf';
import { updateFeatureInfoClick } from 'reducers/map';
import { post } from 'common/requests';
import bbox from '@turf/bbox';
import { WebMercatorViewport } from 'react-map-gl';
import DisplayItinerary from 'applications/osrd/components/Itinerary/DisplayItinerary';

const itineraryURI = '/osrd/pathfinding';

// Obtain only asked vias
const convertPathfindingVias = (steps) => {
  const count = steps.length - 1;
  const vias = [];
  steps.forEach((step, idx) => {
    if (!step.suggestion && idx !== 0 && idx !== count) {
      vias.push(step);
    }
  });
  return vias;
};

const Itinerary = (props) => {
  const [vias, setVias] = useState([]);
  const [launchPathfinding, setLaunchPathfinding] = useState(false);
  const { updateExtViewport } = props;
  const dispatch = useDispatch();
  const map = useSelector((state) => state.map);
  const osrdconf = useSelector((state) => state.osrdconf);

  const viasRedux2state = () => {
    setVias({
      vias: osrdconf.vias.map((item) => ({
        stoptime: item.stoptime,
      })),
    });
  };

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

  // Way to ensure marker position on track
  const correctWaypointsGPS = (pathfindingData) => {
    setLaunchPathfinding(false);

    dispatch(updateOrigin({
      ...osrdconf.origin, clickLngLat: pathfindingData.steps[0].geographic,
    }));

    if (osrdconf.vias.length > 0 && pathfindingData.steps.length > 2) {
      const stepsVias = convertPathfindingVias(pathfindingData.steps);
      dispatch(replaceVias(osrdconf.vias.map((via, idx) => (
        { ...via, clickLngLat: stepsVias[idx].geographic }))));
    }

    dispatch(updateDestination({
      ...osrdconf.destination,
      clickLngLat: pathfindingData.steps[pathfindingData.steps.length - 1].geographic,
    }));
    setLaunchPathfinding(true);
  };

  const mapItinerary = async (zoom = true) => {
    // const geom = (map.mapTrackSources === 'schematic') ? 'sch' : 'geo';
    dispatch(updateItinerary(undefined));

    if (osrdconf.origin !== undefined && osrdconf.destination !== undefined) {
      const params = {
        infra: 27,
        name: 'Test path',
        steps: [],
      };

      // Adding start point
      params.steps.push({
        stop_time: 0,
        waypoints: [{
          track_section: osrdconf.origin.id,
          geo_coordinate: osrdconf.origin.clickLngLat,
        }],
      });

      // Adding via points if exist
      if (osrdconf.vias.length > 0) {
        osrdconf.vias.forEach((via) => {
          params.steps.push({
            stop_time: via.stoptime === undefined ? 0 : Number(via.stoptime),
            waypoints: [{
              track_section: via.id,
              geo_coordinate: via.clickLngLat,
            }],
          });
        });
      }

      // Adding end point
      params.steps.push({
        stop_time: 0,
        waypoints: [{
          track_section: osrdconf.destination.id,
          geo_coordinate: osrdconf.destination.clickLngLat,
        }],
      });

      try {
        console.log(params);
        const itineraryCreated = await post(itineraryURI, params, {}, true);
        correctWaypointsGPS(itineraryCreated);
        dispatch(updateItinerary(itineraryCreated.geographic));
        dispatch(updatePathfindingID(itineraryCreated.id));
        if (zoom) zoomToFeature(bbox(itineraryCreated.geographic));
        console.log(itineraryCreated);
      } catch (e) {
        console.log('ERROR', e);
      }
    }
  };

  useEffect(() => {
    if (osrdconf.pathfindingID === undefined || osrdconf.geojson === undefined) {
      osrdconf.vias.forEach((item) => {
        vias.push({
          time: item.time,
          stoptime: item.stoptime,
        });
      });

      setVias({ vias });
      mapItinerary();
    } else {
      zoomToFeature(bbox(osrdconf.geojson));
    }
    setLaunchPathfinding(true);
  }, []);

  useEffect(() => {
    if (launchPathfinding) {
      if (JSON.stringify(osrdconf.vias) !== JSON.stringify(vias)) {
        mapItinerary(false);
        viasRedux2state(osrdconf.vias);
      } else {
        mapItinerary();
      }
    }
  }, [osrdconf.origin, osrdconf.vias, osrdconf.destination, map.mapTrackSources]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div className="osrd-config-item-container d-flex align-items-end">
          <DisplayItinerary zoomToFeature={zoomToFeature} />
        </div>
      </div>
    </>
  );
};

Itinerary.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};

export default Itinerary;
