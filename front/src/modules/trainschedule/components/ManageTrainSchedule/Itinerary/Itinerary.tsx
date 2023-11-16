import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { WebMercatorViewport } from 'viewport-mercator-project';

import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';
import { updateFeatureInfoClick, updateViewport, Viewport } from 'reducers/map';
import { Position } from 'geojson';

import DisplayItinerary from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';
import { getOrigin, getDestination, getVias } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import Pathfinding from 'common/Pathfinding/Pathfinding';

function Itinerary() {
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const vias = useSelector(getVias);
  const [extViewport, setExtViewport] = useState<Viewport>();
  const dispatch = useDispatch();
  const map = useSelector(getMap);

  const zoomToFeature = (boundingBox: Position, id = undefined) => {
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
    setExtViewport(newViewport);
    if (id) updateFeatureInfoClick(Number(id));
  };

  const zoomToFeaturePoint = (lngLat?: Position, id?: string) => {
    if (lngLat) {
      const newViewport = {
        ...map.viewport,
        longitude: lngLat[0],
        latitude: lngLat[1],
        zoom: 16,
      };
      setExtViewport(newViewport);
      if (id) {
        updateFeatureInfoClick(Number(id));
      }
    }
  };

  const inverseOD = () => {
    if (origin && destination) {
      const newOrigin = { ...origin };
      dispatch(updateOrigin(destination));
      dispatch(updateDestination(newOrigin));
      if (vias && vias.length > 1) {
        const newVias = Array.from(vias);
        dispatch(replaceVias(newVias.reverse()));
      }
    }
  };

  const removeAllVias = () => {
    dispatch(replaceVias([]));
  };

  const viaModalContent = <ModalSugerredVias inverseOD={inverseOD} removeAllVias={removeAllVias} />;

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
  }, [extViewport]);

  return (
    <div className="itinerary mb-2">
      <div className="mb-2">
        <Pathfinding zoomToFeature={zoomToFeature} />
      </div>
      <div className="osrd-config-item-container pathfinding-details" data-testid="itinerary">
        <DisplayItinerary
          zoomToFeaturePoint={zoomToFeaturePoint}
          viaModalContent={viaModalContent}
        />
      </div>
    </div>
  );
}

export default Itinerary;
