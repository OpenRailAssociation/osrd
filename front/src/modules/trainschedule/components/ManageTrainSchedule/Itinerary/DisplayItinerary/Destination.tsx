import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';
import type { Position } from 'geojson';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

interface DestinationProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
}

function Destination({ zoomToFeaturePoint }: DestinationProps) {
  const { getDestination } = useOsrdConfSelectors();
  const { updateDestination, updatePathfindingID } = useOsrdConfActions();
  const destination = useSelector(getDestination);

  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  return (
    <div className="place" data-testid="itinerary-destination">
      {destination !== undefined ? (
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
              {destination.name || destination.location?.track_section?.split('-')[0]}
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
