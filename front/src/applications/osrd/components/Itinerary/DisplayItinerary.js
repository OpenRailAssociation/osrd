import React from 'react';
import PropTypes from 'prop-types';
import { store } from 'Store';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  RiMapPin2Fill,
  RiMapPin3Fill,
  RiMapPin5Fill,
} from 'react-icons/ri';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import DisplayVias from 'applications/osrd/components/Itinerary/DisplayVias';
import { updateOrigin, updateOriginTime, updateOriginSpeed, updateDestination } from 'reducers/osrdconf';

export default function DisplayItinerary(props) {
  const osrdconf = useSelector((state) => state.osrdconf);
  const dispatch = useDispatch();
  const { t } = useTranslation(['osrdconf']);
  const { zoomToFeaturePoint } = props;

  return (
    <div className={
      (osrdconf.origin === undefined
        && osrdconf.destination === undefined
        && osrdconf.vias.length < 1)
        ? '' : 'osrd-config-anchor'
      }
    >
      <h2 className="d-flex align-items-center mb-0 pl-4">
        <span className="mr-1 h2 text-success"><RiMapPin2Fill /></span>
        <span>{t('osrdconf:origin')}</span>
        <small className="ml-1">{osrdconf.pathfindingID}</small>
      </h2>
      <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
        {osrdconf.origin !== undefined ? (
          <>
            <i className="text-success icons-itinerary-bullet mr-2" />
            <div className="pl-1 hover w-100 d-flex align-items-center">
              <div
                onClick={() => zoomToFeaturePoint(
                  osrdconf.origin.clickLngLat, osrdconf.origin.id, osrdconf.origin.source,
                )}
                role="button"
                tabIndex={0}
              >
                <strong className="mr-1 text-nowrap">
                  {osrdconf.origin.id}
                </strong>
              </div>
              <div className="ml-auto osrd-config-time mr-1">
                <InputSNCF
                  type="time"
                  id="osrd-config-time-origin"
                  onChange={(e) => dispatch(updateOriginTime(e.target.value))}
                  value={osrdconf.originTime}
                  sm
                  noMargin
                />
              </div>
              <div className="osrd-config-speed">
                <InputSNCF
                  type="number"
                  id="osrd-config-speed-origin"
                  onChange={(e) => dispatch(updateOriginSpeed(e.target.value))}
                  value={osrdconf.originSpeed}
                  unit="km/h"
                  min={0}
                  max={1000}
                  sm
                  noMargin
                />
              </div>
              <button className="btn btn-sm btn-only-icon btn-white" type="button" onClick={() => store.dispatch(updateOrigin(undefined))}>
                <i className="icons-circle-delete" />
                <span className="sr-only" aria-hidden="true">Delete</span>
              </button>
            </div>
          </>
        ) : (
          <small className="ml-4">{t('osrdconf:noplacechosen')}</small>
        )}
      </div>

      <h2 className="d-flex align-items-center mb-0 ml-4">
        <span className="mr-1 h2 text-info"><RiMapPin3Fill /></span>
        <span>{t('osrdconf:vias')}</span>
      </h2>
      <div className="mb-3">
        {osrdconf.vias.length > 0 ? (
          <DisplayVias zoomToFeaturePoint={zoomToFeaturePoint} />
        ) : (
          <small className="ml-4">{t('osrdconf:noplacechosen')}</small>
        )}

      </div>

      <h2 className="d-flex align-items-center mb-0 ml-4">
        <span className="mr-1 h2 text-warning"><RiMapPin5Fill /></span>
        <span>{t('osrdconf:destination')}</span>
      </h2>
      <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
        {osrdconf.destination !== undefined ? (
          <>
            <i className="text-warning icons-itinerary-bullet mr-2" />
            <div className="pl-1 hover w-100 d-flex align-items-center">
              <div
                onClick={() => zoomToFeaturePoint(
                  osrdconf.destination.clickLngLat,
                  osrdconf.destination.id,
                  osrdconf.destination.source,
                )}
                role="button"
                tabIndex={0}
                className="flex-grow-1"
              >
                <strong className="mr-1 text-nowrap">
                  {osrdconf.destination.id}
                </strong>
              </div>
              <button className="btn btn-sm btn-only-icon btn-white" type="button" onClick={() => store.dispatch(updateDestination(undefined))}>
                <i className="icons-circle-delete" />
                <span className="sr-only" aria-hidden="true">Delete</span>
              </button>
            </div>
          </>
        ) : (
          <small className="ml-4">{t('osrdconf:noplacechosen')}</small>
        )}
      </div>
    </div>
  );
}

DisplayItinerary.propTypes = {
  zoomToFeaturePoint: PropTypes.func.isRequired,
};
