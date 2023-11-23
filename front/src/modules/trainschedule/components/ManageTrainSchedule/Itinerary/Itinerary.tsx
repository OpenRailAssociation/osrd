import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { WebMercatorViewport } from 'viewport-mercator-project';

import {
  clearVias,
  replaceVias,
  updateDestination,
  updateOrigin,
  updatePathfindingID,
} from 'reducers/osrdconf';
import { updateFeatureInfoClick, updateViewport, Viewport } from 'reducers/map';
import { Position } from 'geojson';

import DisplayItinerary from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSuggerredVias from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';
import { getOrigin, getDestination, getVias, getGeojson } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import Pathfinding from 'common/Pathfinding/Pathfinding';
import { useTranslation } from 'react-i18next';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { GoArrowSwitch, GoPlus, GoRocket, GoTrash } from 'react-icons/go';
import Tipped from 'applications/editor/components/Tipped';
import TypeAndPath from 'common/Pathfinding/TypeAndPath';
import { PathResponse } from 'common/api/osrdEditoastApi';

type ItineraryProps = {
  path?: PathResponse;
};

function Itinerary({ path }: ItineraryProps) {
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const vias = useSelector(getVias);
  const geojson = useSelector(getGeojson);

  const [extViewport, setExtViewport] = useState<Viewport>();
  const [displayTypeAndPath, setDisplayTypeAndPath] = useState(false);
  const dispatch = useDispatch();
  const map = useSelector(getMap);
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { openModal } = useModal();

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
      zoom: zoom < 5 ? 5 : zoom,
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
    dispatch(clearVias());
  };

  const resetPathfinding = () => {
    dispatch(clearVias());
    dispatch(updateOrigin(undefined));
    dispatch(updateDestination(undefined));
    dispatch(updatePathfindingID(undefined));
  };

  const viaModalContent = <ModalSuggerredVias removeAllVias={removeAllVias} />;

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
    <div className="osrd-config-item">
      <div className="mb-2 d-flex">
        <Pathfinding zoomToFeature={zoomToFeature} path={path} />
        <button
          type="button"
          className="btn btn-sm btn-only-icon btn-white px-3 ml-2"
          onClick={() => setDisplayTypeAndPath(!displayTypeAndPath)}
        >
          <GoRocket />
        </button>
      </div>
      {displayTypeAndPath && (
        <div className="mb-1">
          <TypeAndPath zoomToFeature={zoomToFeature} />
        </div>
      )}
      {origin && destination && (
        <div className="d-flex flex-row">
          {geojson && (
            <button
              className="col my-1 text-white btn bg-info btn-sm"
              type="button"
              onClick={() => openModal(viaModalContent)}
            >
              <span className="mr-1">{t('addVias')}</span>
              <GoPlus />
            </button>
          )}
          <button className="col ml-1 my-1 btn bg-warning btn-sm" type="button" onClick={inverseOD}>
            <span className="mr-1">{t('inverseOD')}</span>
            <GoArrowSwitch />
          </button>
          <Tipped mode="right">
            <button
              className="ml-1 mt-1 btn-danger btn btn-sm"
              type="button"
              onClick={resetPathfinding}
            >
              <GoTrash />
            </button>
            <span>{t('deleteRoute')}</span>
          </Tipped>
        </div>
      )}
      <div className="osrd-config-item-container pathfinding-details" data-testid="itinerary">
        <DisplayItinerary zoomToFeaturePoint={zoomToFeaturePoint} />
      </div>
    </div>
  );
}

export default Itinerary;
