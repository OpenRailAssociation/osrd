import { XCircle } from '@osrd-project/ui-icons';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { RiMapPin2Fill } from 'react-icons/ri';
import { useDispatch, useSelector } from 'react-redux';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

type OriginProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const Origin = ({ zoomToFeaturePoint }: OriginProps) => {
  const { getOrigin } = useOsrdConfSelectors();

  const { updateOrigin } = useOsrdConfActions();

  const origin = useSelector(getOrigin);
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

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
            dispatch(updateOrigin(null));
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

export default Origin;
