import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';

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
  updatePathfindingID,
  updateStdcmMode,
} from 'reducers/osrdconf';
import { makeEnumBooleans } from 'utils/constants';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { MODES, STDCM_MODES } from 'applications/operationalStudies/consts';

interface DestinationProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
}

function Destination(props: DestinationProps) {
  const { zoomToFeaturePoint } = props;
  const stdcmMode = useSelector(getStdcmMode);
  const mode = useSelector(getMode);
  const destination = useSelector(getDestination);
  const destinationDate = useSelector(getDestinationDate);
  const destinationTime = useSelector(getDestinationTime);
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, stdcmMode);
  const { isStdcm } = makeEnumBooleans(MODES, mode);

  return (
    <div className="place" data-testid="itinerary-destination">
      {destination !== undefined ? (
        <>
          <div className="pl-1 hover w-100 d-flex align-items-center">
            <span className="text-warning mr-2">
              <IoFlag />
            </span>
            <div
              onClick={() => zoomToFeaturePoint(destination?.coordinates, destination?.id)}
              role="button"
              tabIndex={0}
              className="flex-grow-1"
            >
              <strong className="mr-1 text-nowrap">
                {destination.name ? destination.name : destination.id?.split('-')[0]}
              </strong>
            </div>
            <button
              className="btn btn-sm btn-only-icon btn-white ml-auto"
              type="button"
              onClick={() => {
                dispatch(updateDestination(undefined));
                dispatch(updatePathfindingID(undefined));
              }}
            >
              <i className="icons-circle-delete" />
              <span className="sr-only" aria-hidden="true">
                Delete
              </span>
            </button>
          </div>

          {isStdcm && (
            <div className="d-flex align-items-center ml-4">
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
        </>
      ) : (
        <>
          <span className="text-warning mr-2">
            <IoFlag />
          </span>
          {t('noDestinationChosen')}
        </>
      )}
    </div>
  );
}

export default Destination;
