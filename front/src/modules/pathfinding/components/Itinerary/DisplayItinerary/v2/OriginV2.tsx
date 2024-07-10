import React from 'react';

import { XCircle } from '@osrd-project/ui-icons';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { BiLink, BiUnlink } from 'react-icons/bi';
import { RiMapPin2Fill } from 'react-icons/ri';
import { useDispatch, useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfActions, useOsrdContext, useOsrdConfSelectors } from 'common/osrdContext';
import { MODES } from 'main/consts';
import { makeEnumBooleans } from 'utils/constants';

type OriginProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const OriginV2 = ({ zoomToFeaturePoint }: OriginProps) => {
  const {
    getOriginV2,
    getOriginDate,
    getOriginTime,
    getOriginLinkedBounds,
    getOriginUpperBoundDate,
    getOriginUpperBoundTime,
  } = useOsrdConfSelectors();

  const { mode } = useOsrdContext();

  const {
    updateOriginV2,
    updateOriginDate,
    updateOriginTime,
    updateOriginUpperBoundDate,
    updateOriginUpperBoundTime,
    toggleOriginLinkedBounds,
  } = useOsrdConfActions();

  const origin = useSelector(getOriginV2);
  // TODO TS2 : update stdcm store for trainschedule V2 ?
  const originDate = useSelector(getOriginDate);
  const originTime = useSelector(getOriginTime);
  const originLinkedBounds = useSelector(getOriginLinkedBounds);
  const originUpperBoundDate = useSelector(getOriginUpperBoundDate);
  const originUpperBoundTime = useSelector(getOriginUpperBoundTime);
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { isStdcm } = makeEnumBooleans(MODES, mode);

  const originPointName = (
    <div
      onClick={() => {
        zoomToFeaturePoint(origin?.coordinates, origin?.id);
      }}
      role="button"
      tabIndex={0}
    >
      <strong data-testid="origin-op-info" className="mr-1 text-nowrap">
        {/* If origin doesn't have name, we know that it has been added by click on map and has a track property */}
        {origin?.name || (origin && 'track' in origin && origin.track.split('-')[0])}
      </strong>
    </div>
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

  if (!origin)
    return (
      <>
        <span className="text-success mr-2">
          <RiMapPin2Fill />
        </span>
        <span data-testid="no-origin-chosen-text">{t('noOriginChosen')}</span>
      </>
    );

  return (
    <div className="mb-2 place" data-testid="itinerary-origin">
      <div className="pl-1 hover w-100 d-flex align-items-center">
        <span className="text-success mr-2">
          <RiMapPin2Fill />
        </span>
        <span className="flex-grow-1">{originPointName}</span>
        <button
          data-testid="delete-origin-button"
          className="btn btn-sm btn-only-icon btn-white"
          type="button"
          onClick={() => {
            dispatch(updateOriginV2(null));
          }}
        >
          <XCircle variant="fill" />
          <span className="sr-only" aria-hidden="true">
            Delete
          </span>
        </button>
      </div>
      {isStdcm && (
        <div className="d-flex align-items-center ml-4">
          <div className="d-flex flex-column">
            <div className="d-flex">
              <input
                type="date"
                className="form-control form-control-sm mx-1"
                onChange={(e) => dispatch(updateOriginDate(e.target.value))}
                value={originDate}
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
              />
            </div>
            <div className="d-flex my-1">
              <input
                type="date"
                className="form-control form-control-sm mx-1"
                onChange={(e) => dispatch(updateOriginUpperBoundDate(e.target.value))}
                value={originUpperBoundDate}
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
              />
            </div>
          </div>
          {toggleButton}
        </div>
      )}
    </div>
  );
};

export default OriginV2;
