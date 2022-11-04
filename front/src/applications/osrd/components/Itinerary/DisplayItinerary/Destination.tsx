import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin5Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import { RootState } from 'reducers';
import {
  updateDestination,
  updateDestinationDate,
  updateDestinationTime,
  updateStdcmMode,
} from 'reducers/osrdconf';
import { makeEnumBooleans } from 'utils/constants';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { store } from 'Store';
import { MODES, STDCM_MODES } from '../../../consts';

interface DestinationProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
}

function Destination(props: DestinationProps) {
  const { zoomToFeaturePoint } = props;
  const osrdconf = useSelector((state: RootState) => state.osrdconf);
  const dispatch = useDispatch();
  const { t } = useTranslation(['osrdconf']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, osrdconf.stdcmMode);
  const { isStdcm } = makeEnumBooleans(MODES, osrdconf.mode);

  const destinationTitle = (
    <h2 className="d-flex align-items-center mb-0 ml-4">
      <span className="mr-1 h2 text-warning">
        <RiMapPin5Fill />
      </span>
      <span>{t('osrdconf:destination')}</span>
    </h2>
  );

  return (
    <>
      {destinationTitle}
      <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
        {osrdconf.destination !== undefined ? (
          <>
            <i className="text-warning icons-itinerary-bullet mr-2" />
            <div className="pl-1 hover w-100 d-flex align-items-center">
              <div
                onClick={() =>
                  zoomToFeaturePoint(
                    osrdconf.destination?.clickLngLat,
                    osrdconf.destination?.id,
                    osrdconf.destination?.source
                  )
                }
                role="button"
                tabIndex={0}
                className="flex-grow-1"
              >
                <strong className="mr-1 text-nowrap">
                  {osrdconf.destination.name
                    ? osrdconf.destination.name
                    : osrdconf.destination.id.split('-')[0]}
                </strong>
              </div>

              {isStdcm && (
                <div className="ml-auto d-flex mr-1">
                  <input
                    type="radio"
                    id="stdcmMode"
                    name="stdcmMode"
                    checked={isByDestination}
                    onChange={() => dispatch(updateStdcmMode(STDCM_MODES.byDestination))}
                  />

                  <div className="d-flex">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      onChange={(e) => dispatch(updateDestinationDate(e.target.value))}
                      value={osrdconf.destinationDate}
                      disabled={isByOrigin}
                    />

                    <InputSNCF
                      type="time"
                      id="osrd-config-time-origin"
                      onChange={(e) => dispatch(updateDestinationTime(e.target.value))}
                      value={osrdconf.destinationTime}
                      sm
                      noMargin
                      readonly={isByOrigin}
                    />
                  </div>
                </div>
              )}

              <button
                className="btn btn-sm btn-only-icon btn-white"
                type="button"
                onClick={() => store.dispatch(updateDestination(undefined))}
              >
                <i className="icons-circle-delete" />
                <span className="sr-only" aria-hidden="true">
                  Delete
                </span>
              </button>
            </div>
          </>
        ) : (
          <small className="ml-4">{t('osrdconf:noplacechosen')}</small>
        )}
      </div>
    </>
  );
}

export default Destination;
