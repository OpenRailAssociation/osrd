import { XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import { isPathStepInvalid } from 'modules/pathfinding/utils';
import { getPathSteps, getVias } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { removeElementAtIndex } from 'utils/array';
import { formatUicToCi } from 'utils/strings';

type ViasProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const Vias = ({ zoomToFeaturePoint }: ViasProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const vias = useSelector(getVias());
  const pathSteps = useSelector(getPathSteps);
  const { launchPathfinding } = useManageTimetableItemContext();

  return (
    <>
      {vias.map((via, index) => (
        <div
          key={`${via.id}-${via.positionOnPath}`}
          data-testid="dropped-via-info"
          className={cx('place via', {
            'is-a-stop': via.arrival || via.stopFor,
            'invalid-path-item': isPathStepInvalid(via),
          })}
        >
          <div className="ring" />
          <div className="pl-1 w-100 d-flex align-items-center">
            <div
              className="flex-grow-1"
              onClick={() => zoomToFeaturePoint(via.coordinates, via.id)}
              role="button"
              tabIndex={0}
            >
              <small className="font-weight-bold text-muted mr-1">{index + 1}</small>
              <small data-testid="via-dropped-name" className="mr-1 text-nowrap">
                {`${via.name || (via.positionOnPath && `KM ${(Math.round(via.positionOnPath) / 1000000).toFixed(3)}`) || t('unavailableDistance')}`}
              </small>
              {'secondary_code' in via.location && via.location.secondary_code && (
                <small data-testid="via-dropped-ch">{via.location.secondary_code}</small>
              )}
              {'uic' in via.location && (
                <small data-testid="via-dropped-uic" className="text-muted ml-3">
                  {formatUicToCi(via.location.uic)}
                </small>
              )}
            </div>
            <button
              data-testid="delete-via-button"
              className="btn btn-sm btn-only-icon btn-white ml-auto"
              type="button"
              onClick={() => {
                const newPathSteps = removeElementAtIndex(pathSteps, index + 1);
                launchPathfinding(newPathSteps);
              }}
            >
              <XCircle variant="fill" />
              <span className="sr-only" aria-hidden="true">
                Delete
              </span>
            </button>
          </div>
        </div>
      ))}
    </>
  );
};

export default Vias;
