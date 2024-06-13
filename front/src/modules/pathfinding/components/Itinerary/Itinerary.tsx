import React, { useEffect, useState } from 'react';

import { ArrowSwitch, Plus, Rocket, Trash } from '@osrd-project/ui-icons';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { PathResponse } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import Tipped from 'common/Tipped';
import Pathfinding from 'modules/pathfinding/components/Pathfinding/Pathfinding';
import TypeAndPath from 'modules/pathfinding/components/Pathfinding/TypeAndPath';
import type { Viewport } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

import DisplayItinerary from './DisplayItinerary';
import ModalSuggerredVias from './ModalSuggeredVias';

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
  const dispatch = useAppDispatch();
  const map = useSelector(getMap);
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { openModal } = useModal();

  const zoomToFeatureInItinerary = (boundingBox: Position) => {
    const newViewport = computeBBoxViewport(boundingBox, map.viewport);
    setExtViewport(newViewport);
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
          aria-label={t('toggleTrigramSearch')}
          title={t('toggleTrigramSearch')}
          onClick={() => setDisplayTypeAndPath(!displayTypeAndPath)}
          data-testid="rocket-button"
        >
          <Rocket />
        </button>
      </div>
      {displayTypeAndPath && (
        <div className="mb-2">
          <TypeAndPath zoomToFeature={zoomToFeatureInItinerary} />
        </div>
      )}
      {origin && destination && (
        <div className="d-flex flex-row flex-wrap">
          {geojson && (
            <button
              className="col my-1 text-white btn bg-info btn-sm"
              type="button"
              onClick={() => openModal(viaModalContent)}
            >
              <span className="mr-1">{t('addVias')}</span>
              <Plus />
            </button>
          )}
          <button className="col ml-1 my-1 btn bg-warning btn-sm" type="button" onClick={inverseOD}>
            <span className="mr-1">{t('inverseOD')}</span>
            <ArrowSwitch />
          </button>
          <Tipped mode="right">
            <button
              type="button"
              className="ml-1 mt-1 btn-danger btn btn-sm"
              aria-label={t('deleteRoute')}
              onClick={resetPathfinding}
            >
              <Trash />
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
