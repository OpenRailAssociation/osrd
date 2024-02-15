import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { GoArrowSwitch, GoPlus, GoRocket, GoTrash } from 'react-icons/go';
import type { Position } from 'geojson';

import Tipped from 'applications/editor/components/Tipped';

import DisplayItinerary from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSuggerredVias from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';
import Pathfinding from 'common/Pathfinding/Pathfinding';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import TypeAndPath from 'common/Pathfinding/TypeAndPath';

import { PathResponse } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

import { zoomToFeature } from 'common/Map/WarpedMap/core/helpers';

import type { Viewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { updateViewport } from 'reducers/map';

type ItineraryProps = {
  path?: PathResponse;
};

function Itinerary({ path }: ItineraryProps) {
  const { getOrigin, getDestination, getVias, getGeojson } = useOsrdConfSelectors();
  const { replaceVias, updateDestination, updateOrigin, updatePathfindingID, clearVias } =
    useOsrdConfActions();
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

  const zoomToFeatureInItinerary = (boundingBox: Position) => {
    zoomToFeature(boundingBox, map.viewport, setExtViewport);
  };

  const zoomToFeaturePoint = (lngLat?: Position) => {
    if (lngLat) {
      const newViewport = {
        ...map.viewport,
        longitude: lngLat[0],
        latitude: lngLat[1],
        zoom: 16,
      };
      setExtViewport(newViewport);
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
        <Pathfinding zoomToFeature={zoomToFeatureInItinerary} path={path} />
        <button
          type="button"
          className="btn btn-sm btn-only-icon btn-white px-3 ml-2"
          onClick={() => setDisplayTypeAndPath(!displayTypeAndPath)}
        >
          <GoRocket />
        </button>
      </div>
      {displayTypeAndPath && (
        <div className="mb-2">
          <TypeAndPath zoomToFeature={zoomToFeatureInItinerary} />
        </div>
      )}
      {origin && destination && (

        <div className="d-flex flex-column flex-sm-row flex-wrap gap-2 btn-itinerary-gap">
          {geojson && (
            <button
              className="col text-white btn bg-info btn-sm"
              type="button"
              onClick={() => openModal(viaModalContent)}
            >
              <span className="mr-1">{t('addVias')}</span>
              <GoPlus />
            </button>
          )}
          <button className="col btn bg-warning btn-sm" type="button" onClick={inverseOD}>
            <span className="mr-1">{t('inverseOD')}</span>
            <GoArrowSwitch />
          </button>
          
            <button
              className="col btn-danger btn btn-sm"
              type="button"
              onClick={resetPathfinding}
            >
              <span className="mr-1 d-lg-none">{t('deleteRoute')}</span>
              <GoTrash />
            </button>
                      
        </div>
      )}
      <div className="osrd-config-item-container pathfinding-details mt-2" data-testid="itinerary">
        <DisplayItinerary zoomToFeaturePoint={zoomToFeaturePoint} />
      </div>
    </div>
  );
}

export default Itinerary;
