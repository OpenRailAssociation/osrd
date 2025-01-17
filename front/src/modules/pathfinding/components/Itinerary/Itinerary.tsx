import { useEffect, useState } from 'react';

import { ArrowSwitch, Route, Plus, Rocket, Trash } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { Position } from 'geojson';
import { compact, isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useOsrdConfSelectors } from 'common/osrdContext';
import Tipped from 'common/Tipped';
import Pathfinding from 'modules/pathfinding/components/Pathfinding/Pathfinding';
import TypeAndPath from 'modules/pathfinding/components/Pathfinding/TypeAndPath';
import { setWarning } from 'reducers/main';
import { updateViewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';
import { isEmptyArray } from 'utils/array';

import Destination from './DisplayItinerary/Destination';
import Origin from './DisplayItinerary/Origin';
import Vias from './DisplayItinerary/Vias';
import ModalSuggestedVias from './ModalSuggestedVias';

const Itinerary = () => {
  const { getPathSteps, getOrigin, getDestination, getPowerRestriction } = useOsrdConfSelectors();
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const pathSteps = useSelector(getPathSteps);
  const powerRestrictions = useSelector(getPowerRestriction);

  const [displayTypeAndPath, setDisplayTypeAndPath] = useState(false);
  const dispatch = useAppDispatch();
  const map = useSelector(getMap);
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { openModal } = useModal();

  const { pathProperties, setPathProperties, launchPathfinding, pathStepsAndSuggestedOPs } =
    useManageTrainScheduleContext();

  const zoomToFeaturePoint = (lngLat?: Position) => {
    if (lngLat) {
      const newViewport = {
        ...map.viewport,
        longitude: lngLat[0],
        latitude: lngLat[1],
        zoom: 16,
      };
      dispatch(updateViewport(newViewport));
    }
  };

  const seeWholeItinerary = () => {
    if (pathProperties) {
      const newViewport = computeBBoxViewport(bbox(pathProperties.geometry), map.viewport);
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

  const inverseOD = () => {
    notifyRestrictionResetWarning();

    // Reverse start and end of margins, in prevision of reversing the list of path steps
    const newMargins: (string | undefined)[] = [];
    let prevMargin: string | undefined;
    const cPathSteps = compact(pathSteps); // No step should be null when inverseOD is called (as start and arrival need to be defined), so compact should let the array unchanged
    cPathSteps.forEach((pathStep, index) => {
      // Each margin value is only defined at the start of its margin 'zone'
      // Thus its needs to be pushed to the end of its 'zone', which corresponds to either the start of the next defined margin, or the last step for the last 'zone'
      if (pathStep.theoreticalMargin || index === pathSteps.length - 1) {
        newMargins.push(prevMargin);
        prevMargin = pathStep.theoreticalMargin;
      } else {
        newMargins.push(undefined);
      }
    });

    const newPathSteps = cPathSteps
      .map((pathStep, index) => ({
        ...pathStep,
        arrival: null, // Remove arrival times set as they may become incoherent when reversing
        theoreticalMargin: newMargins[index],
      }))
      .reverse();
    launchPathfinding(newPathSteps);
  };

  const resetPathfinding = () => {
    setPathProperties(undefined);
    notifyRestrictionResetWarning();
    launchPathfinding([null, null]);
  };

  useEffect(() => {
    seeWholeItinerary();
  }, [pathProperties]);

  return (
    <div className="osrd-config-item">
      <div className="mb-2 d-flex">
        <Pathfinding />
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
          <TypeAndPath setDisplayTypeAndPath={setDisplayTypeAndPath} />
        </div>
      )}
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
              onClick={() =>
                openModal(
                  <ModalSuggestedVias
                    suggestedVias={pathStepsAndSuggestedOPs}
                    launchPathfinding={launchPathfinding}
                  />
                )
              }
            >
              <span className="mr-1">{t('addVias')}</span>
              <Plus />
            </button>
          )}
          <button
            data-testid="reverse-itinerary-button"
            className="col ml-1 my-1 btn bg-warning btn-sm"
            type="button"
            onClick={inverseOD}
          >
            <span className="mr-1">{t('inverseOD')}</span>
            <ArrowSwitch />
          </button>
          <Tipped mode="right">
            <button
              data-testid="delete-itinerary-button"
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
