import React, { useMemo, useRef, useState } from 'react';

import {
  Manchette,
  PathLayer,
  SpaceTimeChart,
  TrackOccupancyCanvas,
  TrackOccupancyManchette,
  useManchetteWithSpaceTimeChart,
  WaypointComponent,
  TRACK_HEIGHT_CONTAINER,
  type OccupancyZone,
  type Track,
  isInteractiveWaypoint,
  type OccupancyZonePickingElement,
  isPointPickingElement,
  isSegmentPickingElement,
  BASE_WAYPOINT_HEIGHT,
} from '@osrd-project/ui-charts';
import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';
import type { Meta } from '@storybook/react-vite';

import {
  getOccupancyZonesFromPathAtGivenWaypoint,
  OPERATIONAL_POINTS,
  PATHS,
} from '../spaceTimeChart/helpers/paths';

/**
 * This story shows how to render a Manchette with a SpaceTimeChart, and showing a
 * TrackOccupancyDiagram layer when selecting an operational point.
 */

/**
 * This component shows how to use the useManchetteWithSpaceTimeChart hook with track-occupancy
 * diagrams:
 */
const TrackOccupancyDiagramWithinSpaceTimeChartWrapper = ({ height = 561 }: { height: number }) => {
  // TODO: Restore trains selection from GOV
  const [selectedTrain, setSelectedTrain] = useState<string>();
  const [selectedWaypoint, setSelectedWaypoint] = useState<undefined | string>(
    OPERATIONAL_POINTS[2].id
  );
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);
  const operationalPoints = OPERATIONAL_POINTS;
  const paths = PATHS;

  const splitPoints = useMemo(() => {
    const operationalPoint = operationalPoints.find((wp) => wp.id === selectedWaypoint);
    if (!operationalPoint) return [];

    // Fake tracks:
    const tracks: Track[] = [
      { id: '1', name: 'EV', line: 'line' },
      { id: '2', name: '2', line: 'line' },
      { id: '3', name: '2bis', line: 'line' },
    ];
    const occupancyZones: OccupancyZone[] = paths.flatMap((path, i) =>
      getOccupancyZonesFromPathAtGivenWaypoint(path.points, operationalPoint.position, {
        trainId: path.id,
        trackId: tracks[i % tracks.length].id, // (i.e. pick some random track)
        trainName: 'foobar',
        color: path.color,
      })
    );

    return [
      {
        id: operationalPoint.id,
        position: operationalPoint.position,
        size: tracks.length * TRACK_HEIGHT_CONTAINER + BASE_WAYPOINT_HEIGHT,
        spaceTimeChartNode: (
          <TrackOccupancyCanvas
            position={operationalPoint.position}
            tracks={tracks}
            occupancyZones={occupancyZones}
            selectedTrainId={selectedTrain}
            onClose={() => setSelectedWaypoint(undefined)}
            topPadding={BASE_WAYPOINT_HEIGHT}
          />
        ),
        manchetteNode: (
          <TrackOccupancyManchette tracks={tracks}>
            <div className="waypoint-wrapper flex justify-start">
              <WaypointComponent
                waypoint={{
                  id: operationalPoint.id,
                  name: operationalPoint.label,
                  position: operationalPoint.position,
                  onClick: () => setSelectedWaypoint(undefined),
                }}
                isActive={false}
                isMenuActive={false}
              />
            </div>
          </TrackOccupancyManchette>
        ),
      },
    ];
  }, [paths, selectedTrain, selectedWaypoint, operationalPoints]);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints: operationalPoints.map((op) => ({
      id: op.id,
      position: op.position,
      name: op.label,
      weight: op.importanceLevel,
    })),
    manchetteWithSpaceTimeChartRef,
    height,
    spaceTimeChartRef,
    splitPoints,
    defaultTimeOrigin: Math.min(...paths.map((p) => +p.points[0].time)),
  });

  return (
    <div className="ui-manchette-space-time-chart-wrapper">
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${height}px` }}
        onScroll={handleScroll}
      >
        <Manchette
          {...manchetteProps}
          contents={manchetteProps.contents.map((content) =>
            isInteractiveWaypoint(content)
              ? { ...content, onClick: (waypointId) => setSelectedWaypoint(waypointId) }
              : content
          )}
        />
        <div className="space-time-chart-container w-full sticky" ref={spaceTimeChartRef}>
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            {...spaceTimeChartProps}
            onClick={({ hoveredItem }) => {
              // Handle clicking the occupancyZone items (on the TrackOccupancyCanvas layer):
              if (
                hoveredItem?.layer === 'overlay' &&
                hoveredItem.element.type === 'occupancyZone'
              ) {
                const newId = (hoveredItem.element as OccupancyZonePickingElement).pathId;
                setSelectedTrain(newId === selectedTrain ? undefined : newId);
              }

              // Handle clicking the path items (on the Path layers):
              else if (
                hoveredItem?.layer === 'paths' &&
                (isPointPickingElement(hoveredItem.element) ||
                  isSegmentPickingElement(hoveredItem.element))
              ) {
                const newId = hoveredItem.element.pathId;
                setSelectedTrain(newId === selectedTrain ? undefined : newId);
              }
              // Handle clicking the stage:
              else {
                setSelectedTrain(undefined);
              }
            }}
          >
            {paths.map((path) => (
              <PathLayer
                key={path.id}
                path={path}
                color={path.color}
                level={selectedTrain === path.id ? 1 : 2}
              />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof TrackOccupancyDiagramWithinSpaceTimeChartWrapper> = {
  title: 'Manchette with SpaceTimeChart/Track-occupancy display',
  component: TrackOccupancyDiagramWithinSpaceTimeChartWrapper,
};

export default meta;

export const Default = {
  args: {},
};
