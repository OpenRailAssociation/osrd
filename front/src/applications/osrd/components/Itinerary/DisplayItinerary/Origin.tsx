import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin2Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import {
  updateOrigin,
  updateOriginDate,
  updateOriginTime,
  updateOriginUpperBoundDate,
  updateOriginUpperBoundTime,
  updateOriginSpeed,
  updateStdcmMode,
} from 'reducers/osrdconf';
import { makeEnumBooleans } from 'utils/constants';
import { RootState } from 'reducers';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { store } from 'Store';
import { MODES, STDCM_MODES } from '../../../consts';

interface OriginProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
}

function Origin(props: OriginProps) {
  const { zoomToFeaturePoint } = props;
  const osrdconf = useSelector((state: RootState) => state.osrdconf);
  const dispatch = useDispatch();
  const { t } = useTranslation(['osrdconf']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, osrdconf.stdcmMode);
  const { isSimulation, isStdcm } = makeEnumBooleans(MODES, osrdconf.mode);

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
        <small className="ml-1">{osrdconf.pathfindingID}</small>
      </button>
    </h2>
  );

  const originPointName = (
    <div
      onClick={() => {
        zoomToFeaturePoint(
          osrdconf.origin?.clickLngLat,
          osrdconf.origin?.id,
          osrdconf.origin?.source
        );
      }}
      role="button"
      tabIndex={0}
    >
      <strong className="mr-1 text-nowrap">
        {osrdconf.origin.name ? osrdconf.origin.name : osrdconf.origin.id.split('-')[0]}
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

  return (
    <>
      {originTitle}
      <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
        {osrdconf.origin !== undefined ? (
          <>
            <i className="text-success icons-itinerary-bullet mr-2" />
            <div className="pl-1 hover w-100 d-flex align-items-center">
              {originPointName}
              <div className="ml-auto d-flex mr-1">
                {radioButton}
                <div className="d-flex flex-column">
                  <div className="d-flex">
                    {isStdcm && (
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        onChange={(e) => dispatch(updateOriginDate(e.target.value))}
                        value={osrdconf.originDate}
                        disabled={isByDestination}
                      />
                    )}
                    <InputSNCF
                      type="time"
                      id="osrd-config-time-origin"
                      onChange={(e) => dispatch(updateOriginTime(e.target.value))}
                      value={osrdconf.originTime}
                      sm
                      noMargin
                      readonly={isByDestination}
                    />
                  </div>
                  {isStdcm && (
                    <div className="d-flex">
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        onChange={(e) => dispatch(updateOriginUpperBoundDate(e.target.value))}
                        value={osrdconf.originUpperBoundDate}
                        disabled
                      />
                      <InputSNCF
                        type="time"
                        id="osrd-config-time-origin"
                        onChange={(e) => dispatch(updateOriginUpperBoundTime(e.target.value))}
                        value={osrdconf.originUpperBoundTime}
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
                    onChange={(e) => dispatch(updateOriginSpeed(e.target.value))}
                    value={osrdconf.originSpeed}
                    unit="km/h"
                    min={0}
                    max={1000}
                    sm
                    noMargin
                  />
                </div>
              )}
              <button
                className="btn btn-sm btn-only-icon btn-white"
                type="button"
                onClick={() => store.dispatch(updateOrigin(undefined))}
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
