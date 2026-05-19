import React, { type PropsWithChildren } from 'react';

import cx from 'classnames';

import { TRACK_HEIGHT_CONTAINER } from '../lib/consts';
import type { Track } from '../lib/types';

const TrackOccupancyManchette = ({
  tracks,
  activeTrackId,
  children,
}: PropsWithChildren<{ tracks: Track[]; activeTrackId?: string }>) => (
  <div data-testid="track-occupancy-manchette" className="track-occupancy-manchette">
    {children}
    {tracks.map((track) => (
      // height is shared between manchette and canvas components
      <div
        className={cx('track', { active: activeTrackId === track.id })}
        key={track.id}
        style={{ height: TRACK_HEIGHT_CONTAINER }}
      >
        <span className="track-line">{track.line}</span>
        <div className="track-name">{track.name}</div>
        <div className="track-rail" />
      </div>
    ))}
  </div>
);

export default TrackOccupancyManchette;
