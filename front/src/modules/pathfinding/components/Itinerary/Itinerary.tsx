import { useCallback, useEffect } from 'react';

import { Route, Plus, Trash } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { Position } from 'geojson';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import Pathfinding from 'modules/pathfinding/components/Pathfinding';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import { setWarning } from 'reducers/main';
import {
  getOrigin,
  getDestination,
  getPathSteps,
  getPowerRestrictions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { isEmptyArray } from 'utils/array';

import Destination from './DisplayItinerary/Destination';
import Origin from './DisplayItinerary/Origin';
import Vias from './DisplayItinerary/Vias';
import ModalSuggestedVias from './ModalSuggestedVias';

const Itinerary = ({ rollingStockId }: { rollingStockId: number | undefined }) => {
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const pathSteps = useSelector(getPathSteps);
  const powerRestrictions = useSelector(getPowerRestrictions);

  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const { openModal } = useModal();

  const { pathProperties, launchPathfinding, pathStepsAndSuggestedOPs } =
    useManageTrainScheduleContext();

  const mapSettings = useMapSettings();
  const { updateViewport } = useMapSettingsActions();

  const zoomToFeaturePoint = (lngLat?: Position) => {
    if (lngLat) {
      const newViewport = {
        ...mapSettings.viewport,
        longitude: lngLat[0],
        latitude: lngLat[1],
        zoom: 16,
      };
      dispatch(updateViewport(newViewport));
    }
  };

  const seeWholeItinerary = () => {
    if (pathProperties) {
      const newViewport = computeBBoxViewport(bbox(pathProperties.geometry), mapSettings.viewport);
      dispatch(updateViewport(newViewport));
    }
  };

  const notifyRestrictionResetWarning = () => {
    if (!isEmptyArray(powerRestrictions)) {
      dispatch(
        setWarning({
          title: t('warningMessages.pathfindingChange'),
          text: t('warningMessages.powerRestrictionsReset'),
        })
      );
    }
  };

  const resetPathfinding = () => {
    notifyRestrictionResetWarning();
    launchPathfinding([null, null]);
  };

  useEffect(() => {
    seeWholeItinerary();
  }, [pathProperties]);

  const openModalWithSuggestedVias = useCallback(
    () =>
      openModal(
        <ModalSuggestedVias
          suggestedVias={pathStepsAndSuggestedOPs!}
          launchPathfinding={launchPathfinding}
        />
      ),
    [openModal, pathStepsAndSuggestedOPs, launchPathfinding]
  );

  return (
    <div className="osrd-config-item">
      <div className="mb-2 d-flex">
        <Pathfinding rollingStockId={rollingStockId} />
      </div>
      {origin && destination && (
        <div className="d-flex flex-row flex-wrap">
          <button
            className="col my-1 btn bg-white btn-sm"
            type="button"
            aria-label={t('viewItineraryOnMap')}
            title={t('viewItineraryOnMap')}
            onClick={seeWholeItinerary}
            disabled={isNil(pathProperties)}
          >
            <Route />
          </button>
          {pathStepsAndSuggestedOPs && (
            <button
              data-testid="add-waypoints-button"
              className="col ml-1 my-1 text-white btn bg-info btn-sm"
              type="button"
              onClick={openModalWithSuggestedVias}
            >
              <span className="mr-1">{t('addVias')}</span>
              <Plus />
            </button>
          )}
          <button
            data-testid="delete-itinerary-button"
            type="button"
            title={t('deleteRoute')}
            className="ml-1 my-1 btn-danger btn btn-sm"
            aria-label={t('deleteRoute')}
            onClick={resetPathfinding}
          >
            <Trash />
          </button>
        </div>
      )}
      <div className="osrd-config-item-container pathfinding-details" data-testid="itinerary">
        <div data-testid="display-itinerary">
          <Origin zoomToFeaturePoint={zoomToFeaturePoint} />
          <div className="vias-list mb-2" data-testid="itinerary-vias">
            {pathSteps.length > 2 ? (
              <Vias zoomToFeaturePoint={zoomToFeaturePoint} />
            ) : (
              <small data-testid="no-waypoint-chosen-text" className="ml-4">
                {t('noPlaceChosen')}
              </small>
            )}
          </div>
          <Destination zoomToFeaturePoint={zoomToFeaturePoint} />
        </div>
      </div>
    </div>
  );
};

export default Itinerary;
