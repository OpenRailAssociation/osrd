import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { WebMercatorViewport } from 'viewport-mercator-project';

import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';
import { getVias, getOrigin, getDestination } from 'reducers/osrdconf/selectors';
import { updateFeatureInfoClick } from 'reducers/map';

import DisplayItinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';

function Itinerary(props) {
  const vias = useSelector(getVias);
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const { updateExtViewport } = props;
  const dispatch = useDispatch();
  const map = useSelector((state) => state.map);

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
    if (origin && destination) {
      const neworigin = { ...origin };
      dispatch(updateOrigin(destination));
      dispatch(updateDestination(neworigin));
      if (vias && vias.length > 1) {
        const newVias = Array.from(vias);
        dispatch(replaceVias(newVias.reverse()));
      }
    }
  };

  const removeAllVias = () => {
    dispatch(replaceVias([]));
  };

  const viaModalContent = (
    <ModalSugerredVias
      inverseOD={inverseOD}
      removeAllVias={removeAllVias}
      removeViaFromPath={removeViaFromPath}
    />
  );

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container" data-testid="itinerary">
        <DisplayItinerary
          data-testid="display-itinerary"
          zoomToFeaturePoint={zoomToFeaturePoint}
          zoomToFeature={zoomToFeature}
          viaModalContent={viaModalContent}
        />
      </div>
    </div>
  );
}

Itinerary.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};

export default Itinerary;
