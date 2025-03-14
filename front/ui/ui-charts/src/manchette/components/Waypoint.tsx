import React from 'react';

import cx from 'classnames';

import { type InteractiveWaypoint } from '../types';
import { positionMmToKm } from '../utils';

type WaypointProps = {
  waypoint: InteractiveWaypoint;
  nameRef?: React.RefObject<HTMLDivElement>;
  isActive: boolean;
  isMenuActive?: boolean;
};

const Waypoint = ({
  waypoint: { name, secondaryCode, id, position, onClick },
  nameRef,
  isActive,
  isMenuActive,
}: WaypointProps) => (
  <div
    className={cx('flex waypoint items-baseline', {
      'waypoint-active': isActive,
      'menu-active': isMenuActive,
    })}
    id={id}
    onClick={() => {
      if (onClick && !isMenuActive) onClick(id);
    }}
  >
    <div className="waypoint-position justify-self-start text-end">{positionMmToKm(position)}</div>

    <div ref={nameRef} className="waypoint-name mx-2 justify-self-start">
      {name}
    </div>
    <div className="waypoint-separator"></div>
    <div className="waypoint-ch font-mono justify-self-end">{secondaryCode}</div>
    <div className="waypoint-separator"></div>

    <div className="waypoint-type"></div>
    <div className="waypoint-separator"></div>
  </div>
);

export default Waypoint;
