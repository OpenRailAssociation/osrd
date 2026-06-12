import { Dot, Plus } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { CoreOperationalPointOnPath } from 'common/api/osrdEditoastApi';

type WaypointRowProps = {
  /**
   * The OP to show, or undefined for a requested step that matches no OP along
   * the path (for instance a map-click waypoint), rendered as a placeholder
   */
  op: CoreOperationalPointOnPath | undefined;
  /**
   * Name shown when `op` has none (a requested step matching no OP, like a
   * track-offset point for instance)
   */
  fallbackName?: string;
  /**
   * Number of requested steps this row stands for. A "(n)" suffix is shown when
   * the same OP was selected several times in a row.
   */
  count?: number;
  /**
   * Present on intermediate rows (renders the add button); absent on the
   * requested header row
   */
  onAdd?: () => void;
};

const WaypointRow = ({ op, fallbackName, count, onAdd }: WaypointRowProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal.intermediateWaypointsPanel',
  });
  const station = !!op && op.is_passenger_station;

  return (
    <div
      className={cx('intermediate-waypoints-panel__row', {
        'intermediate-waypoints-panel__row--requested': !onAdd,
      })}
      data-testid="intermediate-waypoint-row"
    >
      <span className="intermediate-waypoints-panel__row-name">
        {op?.name ?? fallbackName ?? '-'}
        {count && count > 1 ? (
          <span className="intermediate-waypoints-panel__row-count"> ({count})</span>
        ) : null}
      </span>
      <span className="intermediate-waypoints-panel__row-station-icon" aria-hidden>
        {/* TODO: Replace this with the train-station icon from ui-icons once it's been added */}
        {station && <i className="icons-itinerary-train-station" />}
      </span>
      <span className="intermediate-waypoints-panel__row-ch">{op?.secondary_code ?? ''}</span>
      {onAdd ? (
        <button
          type="button"
          className="intermediate-waypoints-panel__row-add"
          aria-label={t('addWaypoint')}
          title={t('addWaypoint')}
          onClick={onAdd}
        >
          <Plus />
        </button>
      ) : (
        <span className="intermediate-waypoints-panel__row-status" aria-hidden>
          <Dot variant="fill" />
        </span>
      )}
    </div>
  );
};

export default WaypointRow;
