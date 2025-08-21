import React, { Fragment } from 'react';

import { ZoomIn, ZoomOut } from '@osrd-project/ui-icons';
import cx from 'classnames';

import { INITIAL_OP_LIST_HEIGHT, MAX_ZOOM_Y, MIN_ZOOM_Y } from '../consts';
import type { InteractiveWaypoint } from '../types';
import Waypoint from './Waypoint';
import { isInteractiveWaypoint } from '../utils/helpers';

export type ManchetteProps = {
  contents: (InteractiveWaypoint | React.ReactNode)[];
  activeWaypointId?: string;
  activeWaypointRef?: React.RefObject<HTMLDivElement | null>;
  zoomYIn: () => void;
  zoomYOut: () => void;
  resetZoom: () => void;
  height?: number;
  yZoom?: number;
  children?: React.ReactNode;
  isProportional?: boolean;
  testIdPrefix?: string;
  toggleMode: () => void;
};

const Manchette = ({
  zoomYIn,
  zoomYOut,
  resetZoom,
  yZoom = 1,
  contents,
  activeWaypointId,
  activeWaypointRef,
  isProportional = true,
  toggleMode,
  children,
  height = INITIAL_OP_LIST_HEIGHT,
}: ManchetteProps) => (
  <div className="ui-manchette-container">
    <div
      className="bg-white-100 border-r border-grey-30 relative"
      style={{ minHeight: `${height}px` }}
    >
      <div className="waypoints-list">
        {contents.map((content, index) =>
          isInteractiveWaypoint(content) ? (
            <div key={index} className="waypoint-wrapper flex justify-start" style={content.styles}>
              <Waypoint
                waypoint={content}
                waypointRef={activeWaypointId === content.id ? activeWaypointRef : undefined}
                isActive={activeWaypointId === content.id}
                isMenuActive={!!activeWaypointId}
                testIdPrefix="waypoint"
              />
            </div>
          ) : (
            <Fragment key={index}>{content}</Fragment>
          )
        )}
        {children}
      </div>
    </div>
    <div data-testid="manchette-actions" className="manchette-actions">
      <div className="zoom-buttons">
        <button
          data-testid="zoom-out-button"
          className="zoom-out"
          onClick={zoomYOut}
          disabled={yZoom <= MIN_ZOOM_Y || !!activeWaypointId}
        >
          <ZoomOut />
        </button>
        <button
          data-testid="zoom-in-button"
          className="zoom-in"
          onClick={zoomYIn}
          disabled={yZoom >= MAX_ZOOM_Y || !!activeWaypointId}
        >
          <ZoomIn />
        </button>
        <button
          data-testid="reset-zoom-button"
          disabled={!!activeWaypointId}
          className="zoom-reset"
          onClick={resetZoom}
        >
          Fit
        </button>
      </div>
      <div className="flex items-center ml-auto text-sans font-semibold">
        <button disabled={!!activeWaypointId} className="toggle-mode" onClick={toggleMode}>
          <div className="flex flex-col items-end pr-2">
            <span className={cx({ 'text-grey-30': !isProportional })} data-testid="km-mode-button">
              Km
            </span>

            <span
              className={cx({ 'text-grey-30': isProportional })}
              data-testid="linear-mode-button"
            >
              Linéaire
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
);

export default Manchette;
