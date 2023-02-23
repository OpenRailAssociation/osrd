import React from 'react';
import PropTypes from 'prop-types';
import { WebMercatorViewport } from 'viewport-mercator-project';

import DisplayItinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';



function Itinerary(props) {
  const {
    dispatchUpdateExtViewport,
    dispatchUpdateFeatureInfoClick,
    dispatchReplaceVias,
    dispatchUpdateOrigin,
    dispatchUpdateDestination,
    map,
    infra,
    origin,
    destination,
    vias,
  } = props;

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
    dispatchUpdateExtViewPort(newViewport);
    if (id !== undefined && source !== undefined) {
      dispatchUpdateFeatureInfoClick(Number(id), source);
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
      dispatchUpdateExtViewport(newViewport);
      if (id !== undefined && source !== undefined) {
        dispatchUpdateFeatureInfoClick(Number(id), source);
      }
    }
  };

  const removeViaFromPath = (step) => {
    dispatchReplaceVias(vias.filter((via) => via.track !== step.track));
  };

  const inverseOD = () => {
    if (origin && destination) {
      const origin = { ...origin };
      dispatchUpdateOrigin(destination);
      dispatchUpdateDestination(origin);
      if (vias && vias.length > 1) {
        const newVias = Array.from(vias);
        dispatchReplaceVias(newVias.reverse());
      }
    }
  };

  const removeAllVias = () => {
    dispatchReplaceVias([]);
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
          {...props}
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
