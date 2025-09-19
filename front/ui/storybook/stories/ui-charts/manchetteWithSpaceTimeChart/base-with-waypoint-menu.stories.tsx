import React, { useRef, useState } from 'react';

import {
  SpaceTimeChart,
  Manchette,
  type ProjectPathTrainResult,
  type Waypoint,
  useManchetteWithSpaceTimeChart,
  isInteractiveWaypoint,
  PathLayer,
  usePaths,
} from '@osrd-project/ui-charts';
import { EyeClosed, Telescope } from '@osrd-project/ui-icons';
import type { Meta } from '@storybook/react-vite';
import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

import AnchoredMenu from './AnchoredMenu';
import { SAMPLE_PATHS_DATA, SAMPLE_WAYPOINTS } from './assets/sampleData';
import Menu, { type MenuItem } from './Menu';

type ManchetteWithSpaceTimeWrapperProps = {
  waypoints: Waypoint[];
  projectPathTrainResult: ProjectPathTrainResult[];
  selectedTrain: number;
};

/**
 * Example of setting up a menu for the waypoints.
 * When displayed, the interaction with the rest of the manchette is disabled,
 * the scroll inside the manchette is locked and the pan in the space time chart is disabled.
 * */

const ManchetteWithSpaceTimeWrapper = ({
  waypoints,
  projectPathTrainResult,
  selectedTrain,
}: ManchetteWithSpaceTimeWrapperProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  // Allow us to know which waypoint has been clicked and change its style
  const [activeWaypointId, setActiveWaypointId] = useState<string>();

  const menuRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = [
    {
      title: 'Action 1',
      icon: <EyeClosed />,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveWaypointId(undefined);
      },
    },
    {
      title: 'Action 2',
      icon: <Telescope />,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveWaypointId(undefined);
      },
    },
  ];

  const waypointMenu = AnchoredMenu({
    children: activeWaypointId && <Menu menuRef={menuRef} items={menuItems} />,
    anchorRef: activeWaypointRef,
    onDismiss: () => setActiveWaypointId(undefined),
  });

  const handleWaypointClick = (waypointId: string) => {
    setActiveWaypointId(waypointId);
  };

  const paths = usePaths(projectPathTrainResult);
  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    defaultTimeOrigin: Math.min(...projectPathTrainResult.map((p) => +p.departureTime)),
  });

  const selectedPath = paths[selectedTrain].id;

  return (
    <div className="ui-manchette-space-time-chart-wrapper">
      <div
        className="header bg-ambientB-5 w-full border-b border-grey-30"
        style={{ height: '40px' }}
      ></div>
      <div ref={manchetteWithSpaceTimeChartRef} className="manchette flex" onScroll={handleScroll}>
        <Manchette
          {...manchetteProps}
          contents={manchetteProps.contents.map((op) =>
            isInteractiveWaypoint(op)
              ? {
                  ...op,
                  onClick: handleWaypointClick,
                }
              : op
          )}
          activeWaypointId={activeWaypointId}
          activeWaypointRef={activeWaypointRef}
        />
        {waypointMenu}
        <div className="space-time-chart-container w-full sticky">
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            {...spaceTimeChartProps}
            onPan={activeWaypointId ? undefined : spaceTimeChartProps.onPan}
          >
            {paths.map((path) => (
              <PathLayer
                key={path.id}
                path={path}
                color={path.color}
                level={path.id === selectedPath ? 1 : 2}
              />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof ManchetteWithSpaceTimeWrapper> = {
  title: 'Manchette with SpaceTimeChart/Waypoints menus',
  component: ManchetteWithSpaceTimeWrapper,
};

export default meta;

export const WaypointMenu = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    projectPathTrainResult: SAMPLE_PATHS_DATA,
    selectedTrain: 1,
  },
};
