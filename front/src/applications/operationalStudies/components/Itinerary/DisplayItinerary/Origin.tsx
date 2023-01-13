import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin2Fill } from 'react-icons/ri';
import { BiLink, BiUnlink } from 'react-icons/bi';
import { useTranslation } from 'react-i18next';

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
import {
  getStdcmMode,
  getMode,
  getOrigin,
  getOriginDate,
  getOriginTime,
  getOriginSpeed,
  getOriginLinkedBounds,
  getOriginUpperBoundDate,
  getOriginUpperBoundTime,
  getPathfindingID,
} from 'reducers/osrdconf/selectors';
import { makeEnumBooleans } from 'utils/constants';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { MODES, STDCM_MODES } from '../../../consts';

import './display-itinerary.scss';

interface OriginProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
}

function Origin(props: OriginProps) {
  const { zoomToFeaturePoint } = props;
  const stdcmMode = useSelector(getStdcmMode);
  const mode = useSelector(getMode);
  const origin = useSelector(getOrigin);
  const originDate = useSelector(getOriginDate);
  const originTime = useSelector(getOriginTime);
  const originSpeed = useSelector(getOriginSpeed);
  const originLinkedBounds = useSelector(getOriginLinkedBounds);
  const originUpperBoundDate = useSelector(getOriginUpperBoundDate);
  const originUpperBoundTime = useSelector(getOriginUpperBoundTime);
  const pathfindingID = useSelector(getPathfindingID);
  const dispatch = useDispatch();
  const { t } = useTranslation(['osrdconf']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, stdcmMode);
  const { isSimulation, isStdcm } = makeEnumBooleans(MODES, mode);

  const originTitle = (
    <h2 className="d-flex align-items-center mb-0 pl-4">
      <span className="mr-1 h2 text-success">
        <RiMapPin2Fill />
      </span>
      <span>{t('osrdconf:origin')}</span>
      <button
        type="button"
        data-toggle="modal"
        data-target="#modalPathJSONDetail"
        className="btn btn-link"
      >
        <small className="ml-1">{pathfindingID}</small>
      </button>
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
        title={t(originLinkedBounds ? 'osrdconf:BoundsAreLinked' : 'osrdconf:BoundsAreNotLinked')}
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
                        value={originDate}
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
                        value={originUpperBoundDate}
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
          <small className="ml-4">{t('osrdconf:noplacechosen')}</small>
        )}
      </div>
    </>
  );
}

export default Origin;
