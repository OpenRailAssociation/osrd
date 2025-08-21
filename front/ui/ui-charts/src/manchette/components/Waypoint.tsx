import React, { type ReactNode } from 'react';

import cx from 'classnames';

import { type InteractiveWaypoint } from '../types';
import { positionMmToKm } from '../utils';

type WaypointProps = {
  waypoint: Omit<InteractiveWaypoint, 'name'> & { name?: ReactNode };
  waypointRef?: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  isMenuActive?: boolean;
  testIdPrefix?: string;
};

const Waypoint = ({
  waypoint: { name, secondaryCode, id, position, onClick },
  waypointRef,
  isActive,
  isMenuActive,
  testIdPrefix,
}: WaypointProps) => (
  <div
    data-testid={testIdPrefix ? `${testIdPrefix}-base-info` : undefined}
    className={cx('flex waypoint items-baseline', {
      'waypoint-active': isActive,
      'menu-active': isMenuActive,
    })}
    id={id}
    ref={waypointRef}
    onClick={() => {
      if (onClick && !isMenuActive) onClick(id);
    }}
  >
    <div
      data-testid={testIdPrefix ? `${testIdPrefix}-position` : undefined}
      className="waypoint-position justify-self-start text-end"
    >
      {positionMmToKm(position)}
    </div>

    <div
      data-testid={testIdPrefix ? `${testIdPrefix}-name` : undefined}
      className="waypoint-name mx-2 justify-self-start"
    >
      {name}
    </div>
    <div className="waypoint-separator"></div>
    <div
      data-testid={testIdPrefix ? `${testIdPrefix}-ch` : undefined}
      className="waypoint-ch font-mono justify-self-end"
    >
      {secondaryCode}
    </div>
    <div className="waypoint-separator"></div>

    <div className="waypoint-type"></div>
    <div className="waypoint-separator"></div>
  </div>
);

export default Waypoint;
