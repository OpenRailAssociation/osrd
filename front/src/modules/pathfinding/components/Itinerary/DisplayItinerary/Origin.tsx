import { XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { RiMapPin2Fill } from 'react-icons/ri';
import { useSelector } from 'react-redux';

import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import { isPathStepInvalid } from 'modules/pathfinding/utils';
import { getOrigin, getPathSteps } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { formatUicToCi } from 'utils/strings';

type OriginProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const Origin = ({ zoomToFeaturePoint }: OriginProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const { launchPathfinding } = useManageTimetableItemContext();

  const origin = useSelector(getOrigin);
  const pathSteps = useSelector(getPathSteps);
  const location = origin?.location;

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
        {origin?.name || (location && 'track' in location && location.track.split('-')[0])}
      </strong>
      {location && 'operational_point' in location && location.operational_point.type !== 'id' && (
        <>
          {location.operational_point.secondary_code && (
            <small data-testid="origin-ch" className="ml-1">
              {location.operational_point.secondary_code}
            </small>
          )}
          {location.operational_point.type === 'uic' && (
            <small data-testid="origin-uic" className="text-muted ml-3">
              {formatUicToCi(location.operational_point.uic)}
            </small>
          )}
        </>
      )}
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
    <div
      className={cx('mb-2 place', { 'invalid-path-item': isPathStepInvalid(origin) })}
      data-testid="itinerary-origin"
    >
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
            launchPathfinding([null, ...pathSteps.slice(1)]);
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
