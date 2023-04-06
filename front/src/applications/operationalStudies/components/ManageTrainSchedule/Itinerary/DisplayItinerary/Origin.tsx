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
  updateStdcmMode,
  toggleOriginLinkedBounds,
} from 'reducers/osrdconf';
import {
  getStdcmMode,
  getMode,
  getOrigin,
  getOriginDate,
  getOriginTime,
  getOriginLinkedBounds,
  getOriginUpperBoundDate,
  getOriginUpperBoundTime,
} from 'reducers/osrdconf/selectors';
import { makeEnumBooleans } from 'utils/constants';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { MODES, STDCM_MODES } from 'applications/operationalStudies/consts';

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
  const originLinkedBounds = useSelector(getOriginLinkedBounds);
  const originUpperBoundDate = useSelector(getOriginUpperBoundDate);
  const originUpperBoundTime = useSelector(getOriginUpperBoundTime);
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, stdcmMode);
  const { isStdcm } = makeEnumBooleans(MODES, mode);

  const originPointName = (
    <div
      onClick={() => {
        zoomToFeaturePoint(origin?.coordinates, origin?.id, origin?.source);
      }}
      role="button"
      tabIndex={0}
    >
      <strong className="mr-1 text-nowrap">
        {origin?.name ? origin?.name : origin?.id.split('-')[0]}
      </strong>
    </div>
  );

  const radioButton = (
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
    <div className="mb-3 d-flex align-items-center w-100 osrd-config-place">
      <span className="text-success mr-2">
        <RiMapPin2Fill />
      </span>
      {origin !== undefined ? (
        <div className="pl-1 hover w-100 origin-name-and-time-container">
          {originPointName}
          {isStdcm && (
            <>
              <div className="ml-auto d-flex mr-1">
                {radioButton}
                <div className="d-flex flex-column">
                  <div className="d-flex">
                    <input
                      type="date"
                      className="form-control form-control-sm mx-1"
                      onChange={(e) => dispatch(updateOriginDate(e.target.value))}
                      value={originDate}
                      disabled
                    />
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
                </div>
              </div>
              {toggleButton}
            </>
          )}
          <button
            className="btn btn-sm btn-only-icon btn-white ml-auto"
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
      ) : (
        <small>{t('noOriginChosen')}</small>
      )}
    </div>
  );
}

export default Origin;
