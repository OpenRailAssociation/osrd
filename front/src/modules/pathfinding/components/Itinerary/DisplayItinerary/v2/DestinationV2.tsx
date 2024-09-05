import { XCircle } from '@osrd-project/ui-icons';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';
import { useDispatch, useSelector } from 'react-redux';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

type DestinationProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const DestinationV2 = ({ zoomToFeaturePoint }: DestinationProps) => {
  const { getDestinationV2 } = useOsrdConfSelectors();
  const { updateDestinationV2 } = useOsrdConfActions();
  const destination = useSelector(getDestinationV2);

  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  if (!destination)
    return (
      <>
        <span className="text-warning mr-2">
          <IoFlag />
        </span>
        <span data-testid="no-destination-chosen-text">{t('noDestinationChosen')}</span>
      </>
    );

  return (
    <div className="place" data-testid="itinerary-destination">
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
          <strong data-testid="destination-op-info" className="mr-1 text-nowrap">
            {/* If destination doesn't have name, we know that it has been added by click on map and has a track property */}
            {destination?.name ||
              (destination && 'track' in destination && destination.track.split('-')[0])}
          </strong>
        </div>
        <button
          data-testid="delete-destination-button"
          className="btn btn-sm btn-only-icon btn-white ml-auto"
          type="button"
          onClick={() => {
            dispatch(updateDestinationV2(null));
          }}
        >
          <XCircle variant="fill" />
          <span className="sr-only" aria-hidden="true">
            Delete
          </span>
        </button>
      </div>
    </div>
  );
};

export default DestinationV2;
