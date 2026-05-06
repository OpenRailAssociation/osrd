import { Dot, Plus } from '@osrd-project/ui-icons';
import cx from 'classnames';

import type { SuggestedOP } from 'modules/trainSchedule/types';

type WaypointRowProps = {
  /**
   * The operational point this row displays, or undefined for a requested step
   * that matches no OP along the path (for instance a map-click waypoint)
   * which renders as a placeholder row:
   */
  op: SuggestedOP | undefined;
  isRequested: boolean;
};

const WaypointRow = ({ op, isRequested }: WaypointRowProps) => {
  const station = !!op && op.isPassengerStation;

  return (
    <div
      className={cx('intermediate-waypoints-panel__row', {
        'intermediate-waypoints-panel__row--requested': isRequested,
      })}
      data-testid="intermediate-waypoint-row"
    >
      <span className="intermediate-waypoints-panel__row-name">{op?.name ?? '-'}</span>
      <span className="intermediate-waypoints-panel__row-station-icon" aria-hidden>
        {/* TODO: Replace this with the train-station icon from ui-icons once it's been added */}
        {station && <i className="icons-itinerary-train-station" />}
      </span>
      <span className="intermediate-waypoints-panel__row-ch">{op?.secondaryCode ?? ''}</span>
      {isRequested ? (
        <span className="intermediate-waypoints-panel__row-status" aria-hidden>
          <Dot variant="fill" />
        </span>
      ) : (
        // TODO: Implement the logic behind this button, and enable it
        <button
          type="button"
          className="intermediate-waypoints-panel__row-add"
          aria-hidden
          disabled
        >
          <Plus />
        </button>
      )}
    </div>
  );
};

export default WaypointRow;
