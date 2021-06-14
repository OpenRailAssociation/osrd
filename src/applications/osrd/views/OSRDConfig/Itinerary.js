import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { updateItinerary, updatePathfindingID } from 'reducers/osrdconf';
import { updateFeatureInfoClick } from 'reducers/map';
import { post } from 'common/requests';
import bbox from '@turf/bbox';
import { WebMercatorViewport } from 'react-map-gl';
import DisplayItinerary from 'applications/osrd/components/Itinerary/DisplayItinerary';

const itineraryURI = '/osrd/pathfinding';

const Itinerary = (props) => {
  const [vias, setVias] = useState([]);
  const { updateExtViewport } = props;
  const dispatch = useDispatch();
  const map = useSelector((state) => state.map);
  const osrdconf = useSelector((state) => state.osrdconf);

  const viasRedux2state = () => {
    setVias({
      vias: osrdconf.vias.map((item) => ({
        time: item.time,
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

  const mapItinerary = async (zoom = true) => {
    // const geom = (map.mapTrackSources === 'schematic') ? 'sch' : 'geo';

    if (osrdconf.origin !== undefined && osrdconf.destination !== undefined) {
      const params = {
        infra: 27,
        name: 'Test path',
        waypoints: [],
      };

      // Adding start point
      params.waypoints.push([{
        track_section: osrdconf.origin.id,
        geo_coordinate: osrdconf.origin.clickLngLat,
      }]);

      // Adding via points if exist
      if (osrdconf.vias.length > 0) {
        osrdconf.vias.forEach((via) => {
          params.waypoints.push([{
            track_section: via.id,
            geo_coordinate: via.clickLngLat,
          }]);
        });
      }

      // Adding end point
      params.waypoints.push([{
        track_section: osrdconf.destination.id,
        geo_coordinate: osrdconf.destination.clickLngLat,
      }]);

      console.log(params);

      try {
        const itineraryCreated = await post(itineraryURI, params, {}, true);
        dispatch(updateItinerary(itineraryCreated.geographic));
        dispatch(updatePathfindingID(itineraryCreated.id));
        if (zoom) zoomToFeature(bbox(itineraryCreated.geographic));
        console.log('coucou', itineraryCreated.id);
      } catch (e) {
        console.log('ERROR', e);
      }
    }
  };

  useEffect(() => {
    osrdconf.vias.forEach((item) => {
      vias.push({
        time: item.time,
        stoptime: item.stoptime,
      });
    });

    setVias({ vias });
    mapItinerary();
  }, []);

  useEffect(() => {
    if (JSON.stringify(osrdconf.vias) !== JSON.stringify(vias)) {
      mapItinerary(false);
      viasRedux2state(osrdconf.vias);
    } else {
      mapItinerary();
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
