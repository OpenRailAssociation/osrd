import React, { type PropsWithChildren } from 'react';

import { TRACK_HEIGHT_CONTAINER } from '../lib/consts';
import type { Track } from '../lib/types';

type TrackOccupancyManchetteProps = PropsWithChildren<{ tracks: Track[]; width?: number }>;

const TrackOccupancyManchette = ({
  tracks,
  children,
}: TrackOccupancyManchetteProps) => (
  <div className="track-occupancy-manchette">
    {children}
    {tracks.map((track) => (
      // height is shared between manchette and canvas components
      <div className="track" key={track.id} style={{ height: TRACK_HEIGHT_CONTAINER }}>
        <span className="track-line">{track.line}</span>
        <div className="track-name">{track.name}</div>
        <div className="track-rail" />
      </div>
    ))}
  </div>
);

export default TrackOccupancyManchette;
