import React, { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin2Fill } from 'react-icons/ri';
import { BiLink, BiUnlink } from 'react-icons/bi';
import { useTranslation } from 'react-i18next';

import { makeEnumBooleans } from 'utils/constants';
import { ValueOf } from 'utils/types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { MODES, STDCM_MODES } from 'applications/operationalStudies/consts';

import {
  getStdcmMode,
  getMode,
  getOrigin,
  getOriginTime,
  getOriginSpeed,
  getOriginLinkedBounds,
  getOriginUpperBoundDate,
  getOriginUpperBoundTime,
  getOriginDate,
} from 'reducers/osrdconf/selectors';
import {
  getStdcmMode as getStdcmModeStdcm,
  getMode as getModeStdcm,
  getDestination as getDestinationStdcm,
  getOriginTime as getOriginTimeStdcm,
  getOriginSpeed as getOriginSpeedStdcm,
  getOriginLinkedBounds as getOriginLinkedBoundsStdcm,
  getOriginUpperBoundDate as getOriginUpperBoundDateStdcm,
  getOriginUpperBoundTime as getOriginUpperBoundTimeStdcm,
  getOriginDate as getOriginDateStdcm,
} from 'reducers/osrdStdcmConf/selectors';

import {
  updateOrigin,
  updateOriginDate,
  updateOriginTime,
  updateOriginUpperBoundDate,
  updateOriginUpperBoundTime,
  updateOriginSpeed,
  updateStdcmMode,
  toggleOriginLinkedBounds,
} from 'reducers/osrdconf';
import { Dispatch } from 'redux';

export interface OriginProps {
  zoomToFeaturePoint?: (lngLat?: Position, id?: string, source?: string) => void;
  stdcmMode?: ValueOf<typeof STDCM_MODES>;
  mode?: ValueOf<typeof MODES>;
  origin?: any; // declare origin as any type
  originDate?: string | Date;
  originTime?: Date;
  originSpeed?: number;
  originLinkedBounds?: any;
  originUpperBoundDate?: string | Date;
  originUpperBoundTime?: Date;
  dispatch?: Dispatch;
}

export function withStdcmData<T>(Component: ComponentType<T>) {
  return (hocProps: OriginProps) => {
    const dispatch = useDispatch();
    const stdcmMode = useSelector(getStdcmModeStdcm);
    const mode = MODES.stdcm;
    const originDate = useSelector(getStdcmModeStdcm);
    const originTime = useSelector(getStdcmModeStdcm);
    const originSpeed = useSelector(getStdcmModeStdcm);
    const originLinkedBounds = useSelector(getStdcmModeStdcm);
    const originUpperBoundDate = useSelector(getStdcmModeStdcm);
    const originUpperBoundTime = useSelector(getStdcmModeStdcm);

    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        stdcmMode={stdcmMode}
        mode={mode}
        origin={origin}
        originDate={originDate}
        originTime={originTime}
        originSpeed={originSpeed}
        originLinkedBounds={originLinkedBounds}
        originUpperBoundDate={originUpperBoundDate}
        originUpperBoundTime={originUpperBoundTime}
        t={t}
      />
    );
  };
}

export function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: OriginProps) => {
    const dispatch = useDispatch();
    const stdcmMode = useSelector(getStdcmMode);
    const mode = MODES.simulation;
    const originDate = useSelector(getOriginDate);
    const originTime = useSelector(getOriginTime);
    const originSpeed = useSelector(getOriginSpeed);
    const originLinkedBounds = useSelector(getOriginLinkedBounds);
    const originUpperBoundDate = useSelector(getOriginUpperBoundDate);
    const originUpperBoundTime = useSelector(getOriginUpperBoundTime);

    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        stdcmMode={stdcmMode}
        mode={mode}
        origin={origin}
        originDate={originDate}
        originTime={originTime}
        originSpeed={originSpeed}
        originLinkedBounds={originLinkedBounds}
        originUpperBoundDate={originUpperBoundDate}
        originUpperBoundTime={originUpperBoundTime}
        t={t}
      />
    );
  };
}

function Origin(props: OriginProps) {
  const {
    zoomToFeaturePoint = () => null,
    stdcmMode,
    mode,
    origin,
    originDate,
    originTime,
    originSpeed,
    originLinkedBounds,
    originUpperBoundDate,
    originUpperBoundTime,
    dispatch = () => null,
  } = props;

  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, stdcmMode);
  const { isSimulation, isStdcm } = makeEnumBooleans(MODES, mode);

  const originTitle = (
    <h2 className="d-flex align-items-center mb-0 pl-4">
      <span className="mr-1 h2 text-success">
        <RiMapPin2Fill />
      </span>
      <span>{t('origin')}</span>
    </h2>
  );

  const originPointName = (
    <div
      onClick={() => {
        zoomToFeaturePoint(origin?.clickLngLat, origin?.id, origin?.source);
      }}
      role="button"
      tabIndex={0}
    >
      <strong className="mr-1 text-nowrap">
        {origin?.name ? origin?.name : origin?.id.split('-')[0]}
      </strong>
    </div>
  );

  const radioButton = isStdcm && (
    <input
      type="radio"
      id="stdcmMode"
      name="stdcmMode"
      // className="custom-control-input"
      checked={isByOrigin}
      onChange={() => dispatch(updateStdcmMode(STDCM_MODES.byOrigin))}
    />
  );

  const toggleButton = (
    <div className="toggle-button-container">
      <button
        className="btn btn-sm btn-only-icon btn-white"
        type="button"
        onClick={() => {
          dispatch(toggleOriginLinkedBounds());
        }}
        title={t(originLinkedBounds ? 'BoundsAreLinked' : 'BoundsAreNotLinked')}
      >
        {originLinkedBounds ? <BiLink /> : <BiUnlink />}
        <span className="sr-only" aria-hidden="true">
          Toggle link
        </span>
      </button>
    </div>
  );
  return (
    <>
      {originTitle}
      <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
        {origin !== undefined ? (
          <>
            <i className="text-success icons-itinerary-bullet mr-2" />
            <div className="pl-1 hover w-100 origin-name-and-time-container">
              {originPointName}
              <div className="ml-auto d-flex mr-1">
                {radioButton}
                <div className="d-flex flex-column">
                  <div className="d-flex">
                    {isStdcm && (
                      <input
                        type="date"
                        className="form-control form-control-sm mx-1"
                        onChange={(e) => dispatch(updateOriginDate(e.target.value))}
                        value={originDate as string}
                        disabled
                      />
                    )}
                    <InputSNCF
                      type="time"
                      id="osrd-config-time-origin"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        dispatch(updateOriginTime(e.target.value))
                      }
                      value={originTime}
                      sm
                      noMargin
                      readonly={isByDestination}
                    />
                  </div>
                  {isStdcm && (
                    <div className="d-flex my-1">
                      <input
                        type="date"
                        className="form-control form-control-sm mx-1"
                        onChange={(e) => dispatch(updateOriginUpperBoundDate(e.target.value))}
                        value={originUpperBoundDate as string}
                        disabled
                      />
                      <InputSNCF
                        type="time"
                        id="osrd-config-time-origin"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          dispatch(updateOriginUpperBoundTime(e.target.value))
                        }
                        value={originUpperBoundTime}
                        sm
                        noMargin
                        readonly={isByDestination}
                      />
                    </div>
                  )}
                </div>
              </div>
              {isSimulation && (
                <div className="osrd-config-speed">
                  <InputSNCF
                    type="number"
                    id="osrd-config-speed-origin"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      dispatch(updateOriginSpeed(e.target.value));
                    }}
                    value={originSpeed}
                    unit="km/h"
                    min={0}
                    max={1000}
                    sm
                    noMargin
                  />
                </div>
              )}
              {isStdcm && toggleButton}
              <button
                className="btn btn-sm btn-only-icon btn-white"
                type="button"
                onClick={() => {
                  dispatch(updateOrigin(undefined));
                }}
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

Origin.propTypes = {
  zoomToFeaturePoint: PropTypes.func.isRequired,
  stdcmMode: PropTypes.oneOf(Object.values(STDCM_MODES)).isRequired,
  mode: PropTypes.oneOf(Object.values(MODES)).isRequired,
  origin: PropTypes.any, // you can declare origin as any type
  originDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,
  originTime: PropTypes.instanceOf(Date),
  originSpeed: PropTypes.number,
  originLinkedBounds: PropTypes.any,
  originUpperBoundDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  originUpperBoundTime: PropTypes.instanceOf(Date),
  dispatch: PropTypes.func,
};

Origin.defaultProps = {
  stdcmMode: STDCM_MODES.byOrigin,
  mode: MODES.simulation,
  origin: null,
  originDate: null,
  originTime: null,
  originSpeed: null,
  originLinkedBounds: null,
  originUpperBoundDate: null,
  originUpperBoundTime: null,
  dispatch: () => null,
  t: () => null,
};

export default Origin;
