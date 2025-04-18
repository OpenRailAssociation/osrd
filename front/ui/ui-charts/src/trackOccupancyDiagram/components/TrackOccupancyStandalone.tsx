import React, { useMemo, useRef } from 'react';

import { KebabHorizontal } from '@osrd-project/ui-icons';

import { TRACK_HEIGHT_CONTAINER } from './consts';
import { isOccupancyPickingElement } from './layers/OccupancyZonesLayer';
import TrackOccupancyCanvas from './TrackOccupancyCanvas';
import TrackOccupancyManchette from './TrackOccupancyManchette';
import type { OccupancyZone, Track } from './types';
import { Manchette, useManchetteWithSpaceTimeChart } from '../../manchette';
import { DEFAULT_THEME, SpaceTimeChart } from '../../spaceTimeChart';
import { HOUR } from '../../spaceTimeChart/lib/consts';

const TrackOccupancyStandalone = ({
  tracks,
  occupancyZones,
  selectedTrainId,
  onSelectedTrainIdChange,
  height = TRACK_HEIGHT_CONTAINER * tracks.length + DEFAULT_THEME.timeCaptionsSize,
}: {
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  selectedTrainId?: string;
  onSelectedTrainIdChange?: (selectedTrainId?: string) => void;
  height?: number;
}) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);
  const defaultTimeOrigin = useMemo(() => {
    const minTime = Math.min(...(occupancyZones.map((zone) => zone.startTime) || Date.now()));
    // Take first round hour before minTime:
    return Math.floor(minTime / HOUR) * HOUR;
  }, [occupancyZones]);

  // To make SpaceTimeChart and Manchette work, we have to provide them some dummy data:
  const waypoints = useMemo(
    () => [
      {
        id: 'FAKE_WAYPOINT_1',
        position: 0,
      },
    ],
    []
  );
  const splitPoints = useMemo(
    () => [
      {
        id: 'ACTUAL_TRACK_OCCUPANCY_DIAGRAM',
        position: 0,
        size: Math.max(
          height,
          tracks.length * TRACK_HEIGHT_CONTAINER + DEFAULT_THEME.timeCaptionsSize
        ),
        spaceTimeChartNode: (
          <TrackOccupancyCanvas
            position={0}
            tracks={tracks}
            occupancyZones={occupancyZones}
            selectedTrainId={selectedTrainId}
            hideBorders
          />
        ),
        manchetteNode: <TrackOccupancyManchette tracks={tracks} />,
      },
    ],
    [height, tracks, occupancyZones, selectedTrainId]
  );

  /**
   * We now use useManchetteWithSpaceTimeChart, to get proper pan along the time (and space axis if
   * the container is smaller than the contents):
   */
  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    height,
    spaceTimeChartRef,
    splitPoints,
    defaultTimeOrigin,
    verticalPadding: 0,
    options: {
      displayTimeCaptions: true,
      enableTimePan: true,
      enableSpacePan: true,
      enableTimeZoom: false,
    },
  });

  return (
    <div className="track-occupancy-standalone flex flex-col">
      <div className="bg-ambientB-5 flex flex-col justify-center main-container-header grow-0 shrink-0">
        {/* TODO: Bind actions? */}
        <KebabHorizontal />
      </div>
      <div className="ui-manchette-space-time-chart-wrapper" style={{ maxHeight: height }}>
        <div
          ref={manchetteWithSpaceTimeChartRef}
          className="manchette flex h-100"
          onScroll={handleScroll}
          style={{ height }}
        >
          <Manchette {...manchetteProps} />
          <div className="space-time-chart-container w-full sticky" ref={spaceTimeChartRef}>
            <SpaceTimeChart
              className="inset-0 absolute h-full"
              {...spaceTimeChartProps}
              onClick={
                onSelectedTrainIdChange &&
                (({ hoveredItem }) => {
                  if (
                    hoveredItem?.layer === 'overlay' &&
                    isOccupancyPickingElement(hoveredItem.element)
                  ) {
                    const newId = hoveredItem.element.pathId;
                    onSelectedTrainIdChange(newId === selectedTrainId ? undefined : newId);
                  } else {
                    onSelectedTrainIdChange(undefined);
                  }
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackOccupancyStandalone;
