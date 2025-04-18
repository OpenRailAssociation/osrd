import React, { useRef } from 'react';

import {
  SpaceTimeChart,
  Manchette,
  useManchetteWithSpaceTimeChart,
  type ProjectPathTrainResult,
  type Waypoint,
  ZoomRect,
  PathLayer,
  usePaths,
} from '@osrd-project/ui-charts';
import { Slider } from '@osrd-project/ui-core';
import { ZoomIn } from '@osrd-project/ui-icons';
import type { Meta } from '@storybook/react-vite';
import cx from 'classnames';

import { SAMPLE_WAYPOINTS, SAMPLE_PATHS_DATA } from './assets/sampleData';
import { MouseTracker } from '../spaceTimeChart/helpers/components';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';
import './styles/rectangle-zoom.css';

type ManchetteWithSpaceTimeWrapperProps = {
  waypoints: Waypoint[];
  projectPathTrainResult: ProjectPathTrainResult[];
  selectedTrain: number;
};

const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeWrapper = ({
  waypoints,
  projectPathTrainResult,
  selectedTrain,
}: ManchetteWithSpaceTimeWrapperProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);
  const paths = usePaths(projectPathTrainResult);
  const {
    manchetteProps,
    spaceTimeChartProps,
    rect,
    handleScroll,
    toggleZoomMode,
    zoomMode,
    xZoom,
    handleXZoom,
    timeScale,
    spaceScale,
  } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    height: DEFAULT_HEIGHT,
    spaceTimeChartRef,
    defaultTimeOrigin: Math.min(...projectPathTrainResult.map((p) => +p.departureTime)),
  });
  const selectedPath = paths[selectedTrain].id;
  return (
    <div className="ui-manchette-space-time-chart-wrapper">
      <div
        className="header bg-ambientB-5 w-full border-b border-grey-30"
        style={{ height: '40px' }}
      />
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${DEFAULT_HEIGHT}px` }}
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} />
        <div className="space-time-chart-container w-full sticky" ref={spaceTimeChartRef}>
          <div className="toolbar">
            <button
              type="button"
              className={cx('zoom-button', { 'zoom-button-clicked': zoomMode })}
              onClick={toggleZoomMode}
            >
              <ZoomIn className="icon" />
            </button>
          </div>
          <SpaceTimeChart
            className={cx('inset-0', 'absolute', 'h-full', {
              'space-time-chart-zoom-mode': zoomMode,
            })}
            {...spaceTimeChartProps}
          >
            {paths.map((path) => (
              <PathLayer
                key={path.id}
                path={path}
                color={path.color}
                level={path.id === selectedPath ? 1 : 2}
              />
            ))}
            {rect && <ZoomRect {...rect} />}
            <MouseTracker />
          </SpaceTimeChart>
        </div>
      </div>
      <div className="bottom-controls">
        <div className="scales">
          <div>time scale: {timeScale.toFixed(0)} ms/px</div>
          <div>space scale: {spaceScale.toFixed(0)} mm/px</div>
        </div>
        <Slider
          containerClassName="space-time-h-slider-container"
          className="space-time-h-slider"
          value={xZoom}
          onChange={(e) => {
            handleXZoom(Number(e.target.value));
          }}
        />
      </div>
    </div>
  );
};

const meta: Meta<typeof ManchetteWithSpaceTimeWrapper> = {
  title: 'Manchette with SpaceTimeChart/Zoom rectangle',
  component: ManchetteWithSpaceTimeWrapper,
};

export default meta;

export const Default = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    projectPathTrainResult: SAMPLE_PATHS_DATA,
    selectedTrain: 1,
  },
};
