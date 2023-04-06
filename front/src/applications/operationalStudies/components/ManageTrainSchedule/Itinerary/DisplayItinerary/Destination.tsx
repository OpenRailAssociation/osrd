import React, { ComponentType } from 'react';
import { Dispatch } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin5Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import {
  getStdcmMode,
  getMode,
  getDestination,
  getDestinationDate,
  getDestinationTime,
} from 'reducers/osrdconf/selectors';
import {
  updateDestination,
  updateDestinationDate,
  updateDestinationTime,
  updateStdcmMode,
} from 'reducers/osrdconf';
import { makeEnumBooleans } from 'utils/constants';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { store } from 'Store';
import {
  DEFAULT_MODE,
  DEFAULT_STDCM_MODE,
  MODES,
  PointOnMap,
  STDCM_MODES,
} from 'applications/operationalStudies/consts';
import { noop } from 'lodash';

interface DestinationProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  stdcmMode?: symbol;
  mode?: string;
  destination?: PointOnMap | undefined;
  destinationDate?: string | undefined;
  destinationTime?: string | undefined;
  dispatch?: Dispatch;
}

export function withOSRDData<T>(Component: ComponentType<T>) {
  return function composedDestination(hocProps: T) {
    const stdcmMode = useSelector(getStdcmMode);
    const mode = useSelector(getMode);
    const destination = useSelector(getDestination);
    const destinationDate = useSelector(getDestinationDate);
    const destinationTime = useSelector(getDestinationTime);
    const dispatch = useDispatch();
    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        stdcmMode={stdcmMode}
        mode={mode}
        destination={destination}
        destinationDate={destinationDate}
        destinationTime={destinationTime}
      />
    );
  };
}

export function Destination(props: DestinationProps) {
  const {
    zoomToFeaturePoint = noop,
    dispatch = noop,
    stdcmMode = DEFAULT_STDCM_MODE,
    mode = DEFAULT_MODE,
    destination,
    destinationDate,
    destinationTime,
  } = props;

  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, stdcmMode);
  const { isStdcm } = makeEnumBooleans(MODES, mode);

  const destinationTitle = (
    <h2 className="d-flex align-items-center mb-0 ml-4">
      <span className="mr-1 h2 text-warning">
        <RiMapPin5Fill />
      </span>
      <span>{t('destination')}</span>
    </h2>
  );

  return (
    <>
      {destinationTitle}
      <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
        {destination !== undefined ? (
          <>
            <i className="text-warning icons-itinerary-bullet mr-2" />
            <div className="pl-1 hover w-100 d-flex align-items-center">
              <div
                onClick={() =>
                  zoomToFeaturePoint(destination?.coordinates, destination?.id, destination?.source)
                }
                role="button"
                tabIndex={0}
                className="flex-grow-1"
              >
                <strong className="mr-1 text-nowrap">
                  {destination.name ? destination.name : destination.id.split('-')[0]}
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
                    disabled
                  />

                  <div className="d-flex">
                    <input
                      type="date"
                      className="form-control form-control-sm mx-1"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        dispatch(updateDestinationDate(e.target.value))
                      }
                      value={destinationDate}
                      disabled={isByOrigin}
                    />

                    <InputSNCF
                      type="time"
                      id="osrd-config-time-origin"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        dispatch(updateDestinationTime(e.target.value))
                      }
                      value={destinationTime}
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
          <small className="ml-4">{t('noplacechosen')}</small>
        )}
      </div>
    </>
  );
}

export default withOSRDData(Destination);
