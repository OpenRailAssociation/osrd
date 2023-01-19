import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { WebMercatorViewport } from 'viewport-mercator-project';

import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';
import { updateFeatureInfoClick } from 'reducers/map';

import DisplayItinerary from 'applications/osrd/components/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/osrd/components/Itinerary/ModalSuggeredVias';
import ModalPathJSONDetail from 'applications/osrd/components/Itinerary/ModalPathJSONDetail';
import Pathfinding from 'common/Pathfinding';

function Itinerary(props) {
  const [launchPathfinding, setLaunchPathfinding] = useState(false);
  const { vias } = useSelector((state) => state.osrdconf);
  const { updateExtViewport } = props;
  const dispatch = useDispatch();
  const map = useSelector((state) => state.map);
  const osrdconf = useSelector((state) => state.osrdconf);

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

  const removeViaFromPath = (step) => {
    dispatch(replaceVias(vias.filter((via) => via.track !== step.track)));
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

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div className="osrd-config-item-container">
          <DisplayItinerary zoomToFeaturePoint={zoomToFeaturePoint} />
        </div>
      </div>
      <ModalSugerredVias
        inverseOD={inverseOD}
        removeAllVias={removeAllVias}
        removeViaFromPath={removeViaFromPath}
      />
      <Pathfinding zoomToFeature={zoomToFeature} />
      <ModalPathJSONDetail />
    </>
  );
}

Itinerary.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};

export default Itinerary;
