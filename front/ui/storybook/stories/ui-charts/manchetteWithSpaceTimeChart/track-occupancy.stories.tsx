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
  type CurveStyle,
  type OccupancyZone,
  type Track,
  isInteractiveWaypoint,
  isOccupancyPickingElement,
  isPointPickingElement,
  isSegmentPickingElement,
  BASE_WAYPOINT_HEIGHT,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

import {
  getOccupancyZonesFromPathAtGivenWaypoint,
  OPERATIONAL_POINTS,
  PATHS,
} from '../spaceTimeChart/helpers/paths';

/**
 * This story shows how to render a Manchette with a SpaceTimeChart, and showing a
 * TrackOccupancyDiagram layer when selecting an operational point.
 */

const SELECTED_OCCUPANCY_COLOR = '#1844ef';

const getOccupancyCurveStyle = (color: string, isSelected: boolean): CurveStyle =>
  isSelected
    ? {
        color: SELECTED_OCCUPANCY_COLOR,
        opacity: 1,
        thickness: 5,
        outline: { offset: 0, color: SELECTED_OCCUPANCY_COLOR },
        label: {
          color,
          fontWeight: 600,
          background: { color: '#ffffff', border: color },
        },
      }
    : { color, opacity: 1 };

/**
 * This component shows how to use the useManchetteWithSpaceTimeChart hook with track-occupancy
 * diagrams:
 */
const TrackOccupancyDiagramWithinSpaceTimeChartWrapper = ({ height = 561 }: { height: number }) => {
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
        pathId: path.id,
        trackId: tracks[i % tracks.length].id, // (i.e. pick some random track)
        trainName: 'foobar',
        curveStyle: getOccupancyCurveStyle(path.color, path.id === selectedTrain),
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
            onClose={() => setSelectedWaypoint(undefined)}
            topPadding={BASE_WAYPOINT_HEIGHT}
          />
        ),
        manchetteNode: (
          <TrackOccupancyManchette tracks={tracks}>
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
          </TrackOccupancyManchette>
        ),
      },
    ];
  }, [paths, selectedWaypoint, operationalPoints, selectedTrain]);

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
              const element = hoveredItem?.element;
              if (!element) return setSelectedTrain(undefined);
              // Occupancy zones (TOD) and path items (STD) are both picked on the 'paths'
              // layer, so they're distinguished by element type, not by layer.
              if (
                isOccupancyPickingElement(element) ||
                isPointPickingElement(element) ||
                isSegmentPickingElement(element)
              ) {
                const newId = element.pathId;
                setSelectedTrain(newId === selectedTrain ? undefined : newId);
              } else {
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

export const Default: StoryObj<typeof TrackOccupancyDiagramWithinSpaceTimeChartWrapper> = {
  args: {},
};
