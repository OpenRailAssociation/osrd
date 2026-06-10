import { XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';
import { useSelector } from 'react-redux';

import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import { isPathStepInvalid } from 'modules/pathfinding/utils';
import { getDestination, getPathSteps } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { formatUicToCi } from 'utils/strings';

type DestinationProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const Destination = ({ zoomToFeaturePoint }: DestinationProps) => {
  const { launchPathfinding } = useManageTrainScheduleContext();

  const destination = useSelector(getDestination);
  const pathSteps = useSelector(getPathSteps);
  const location = destination?.location;

  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule',
  });
  if (!destination || pathSteps.length === 1)
    return (
      <>
        <span className="text-warning mr-2">
          <IoFlag />
        </span>
        <span data-testid="no-destination-chosen-text">{t('noDestinationChosen')}</span>
      </>
    );

  return (
    <div
      className={cx('place', {
        'invalid-path-item': isPathStepInvalid(destination),
      })}
      data-testid="itinerary-destination"
    >
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
              (destination &&
                destination.location.type === 'track_offset' &&
                destination.location.track.split('-')[0]) ||
              (destination.location.type === 'operational_point_part_reference' &&
                destination.location.operational_point.type === 'domestic' &&
                destination.location.operational_point.main_code)}
          </strong>
          {location &&
            location.type === 'operational_point_part_reference' &&
            location.operational_point.type !== 'id' && (
              <>
                {location.operational_point.secondary_code && (
                  <small data-testid="destination-ch" className="ml-1">
                    {location.operational_point.secondary_code}
                  </small>
                )}
                {location.operational_point.type === 'uic' && (
                  <small data-testid="destination-uic" className="text-muted ml-3">
                    {formatUicToCi(location.operational_point.uic)}
                  </small>
                )}
              </>
            )}
        </div>
        <button
          data-testid="delete-destination-button"
          className="btn btn-sm btn-only-icon btn-white ml-auto"
          type="button"
          onClick={() => {
            launchPathfinding([...pathSteps.slice(0, -1), null]);
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

export default Destination;
