import React, { ComponentType } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin5Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { ValueOf } from 'utils/types';
import { PointOnMap } from 'applications/operationalStudies/consts';
import { Dispatch } from 'redux';

import { getStdcmMode, getDestination } from 'reducers/osrdconf/selectors';
import {
  getStdcmMode as getStdcmModeStdcm,
  getDestination as getDestinationStdcm,
} from 'reducers/osrdStdcmConf/selectors';
import {
  updateDestination,
  updateDestinationDate,
  updateDestinationTime,
  updateStdcmMode,
} from 'reducers/osrdconf';
import { makeEnumBooleans } from 'utils/constants';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { store } from 'Store';
import { MODES, STDCM_MODES } from 'applications/operationalStudies/consts';

// Values of all these props are supposed to be provided by up to n-2 container (Itinerary), yet the component should work alone
export interface DestinationProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  stdcmMode?: ValueOf<typeof STDCM_MODES>;
  destination?: PointOnMap;
  destinationDate?: string;
  destinationTime?: string;
  'data-testid'?: string;
  dispatch?: Dispatch;
  t?: (s: string) => string;
  mode?: ValueOf<typeof MODES>;
}

export function withStdcmData<T extends DestinationProps>(Component: ComponentType<T>) {
  return (hocProps: DestinationProps) => {
    const dispatch = useDispatch();
    const stdcmMode = useSelector(getStdcmModeStdcm);

    const mode = MODES.stdcm;
    const destination = useSelector(getDestinationStdcm);

    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        stdcmMode={stdcmMode}
        mode={mode}
        origin={origin}
        destination={destination}
        t={t}
      />
    );
  };
}

export function withOSRDSimulationData<T extends DestinationProps>(Component: ComponentType<T>) {
  return (hocProps: DestinationProps) => {
    const dispatch = useDispatch();
    const stdcmMode = useSelector(getStdcmMode);

    const mode = MODES.simulation;
    const destination = useSelector(getDestination);

    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        stdcmMode={stdcmMode}
        mode={mode}
        origin={origin}
        destination={destination}
        t={t}
      />
    );
  };
}

function Destination(props: DestinationProps) {
  const {
    zoomToFeaturePoint = () => null,
    t = () => null,
    dispatch = () => null,
    destinationTime,
    destinationDate,
    destination,
    stdcmMode,
    mode,
  } = props;

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
                  zoomToFeaturePoint(destination?.clickLngLat, destination?.id, destination?.source)
                }
                role="button"
                tabIndex={0}
                className="flex-grow-1"
              >
                <strong className="mr-1 text-nowrap">
                  {destination.name ? destination.name : destination?.id?.split('-')[0]}
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

export default Destination;
