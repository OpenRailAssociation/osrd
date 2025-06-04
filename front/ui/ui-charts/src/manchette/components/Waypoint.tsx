import React, { type ReactNode } from 'react';

import cx from 'classnames';

import { type InteractiveWaypoint } from '../types';
import { positionMmToKm } from '../utils';

type WaypointProps = {
  waypoint: Omit<InteractiveWaypoint, 'name'> & { name?: ReactNode };
  waypointRef?: React.RefObject<HTMLDivElement>;
  isActive: boolean;
  isMenuActive?: boolean;
};

const Waypoint = ({
  waypoint: { name, secondaryCode, id, position, onClick },
  waypointRef,
  isActive,
  isMenuActive,
}: WaypointProps) => (
  <div
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
    <div className="waypoint-position justify-self-start text-end">{positionMmToKm(position)}</div>

    <div className="waypoint-name mx-2 justify-self-start">{name}</div>
    <div className="waypoint-separator"></div>
    <div className="waypoint-ch font-mono justify-self-end">{secondaryCode}</div>
    <div className="waypoint-separator"></div>

    <div className="waypoint-type"></div>
    <div className="waypoint-separator"></div>
  </div>
);

export default Waypoint;
