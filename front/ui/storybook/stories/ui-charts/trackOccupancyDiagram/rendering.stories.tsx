import React, { useEffect, useMemo, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import occupancyZones from './assets/occupancyZones';
import tracks from './assets/tracks';
import { TimeCaptions } from '../../../../ui-charts/src/spaceTimeChart/components/TimeCaptions';
import { useCanvas, useDraw } from '../../../../ui-charts/src/spaceTimeChart/hooks/useCanvas';
import { useMouseInteractions } from '../../../../ui-charts/src/spaceTimeChart/hooks/useMouseInteractions';
import { useMouseTracking } from '../../../../ui-charts/src/spaceTimeChart/hooks/useMouseTracking';
import { useSize } from '../../../../ui-charts/src/spaceTimeChart/hooks/useSize';
import { DEFAULT_THEME } from '../../../../ui-charts/src/spaceTimeChart/lib/consts';
import {
  CanvasContext,
  MouseContext,
  SpaceTimeChartContext,
} from '../../../../ui-charts/src/spaceTimeChart/lib/context';
import type {
  MouseContextType,
  SpaceTimeChartContextType,
  PickingElement,
  SpaceTimeChartTheme,
} from '../../../../ui-charts/src/spaceTimeChart/lib/types';
import {
  getTimeToPixel,
  getSpaceToPixel,
  getDataToPoint,
  getPixelToTime,
  getPixelToSpace,
  getPointToData,
  spaceScalesToBinaryTree,
} from '../../../../ui-charts/src/spaceTimeChart/utils/scales';
import {
  TrackOccupancyManchette,
  TrackOccupancyCanvas,
} from '../../../../ui-charts/src/trackOccupancyDiagram/index';
import { KebabHorizontal } from '../../../../ui-icons/src/index';
import { OPERATIONAL_POINTS } from '../spaceTimeChart/helpers/paths';

type TrackOccupancyDiagramProps = {
  xZoomLevel: number;
  yZoomLevel: number;
  xOffset: number;
  yOffset: number;
  spaceScaleType: 'linear' | 'proportional';
  emptyData: boolean;
  selectedTrainId: string;
  setSelectedTrainId: (id: string) => void;
};

const OP_ID = 'story';
const X_ZOOM_LEVEL = 6;
const Y_ZOOM_LEVEL = 3;
const SELECTED_TRAIN_ID = '5';

const TrackOccupancyDiagram = ({
  xZoomLevel,
  yZoomLevel,
  xOffset,
  yOffset,
  spaceScaleType,
  emptyData,
  selectedTrainId,
  setSelectedTrainId,
}: TrackOccupancyDiagramProps) => {
  const spaceOrigin = 0;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const { width, height } = useSize(root);
  const [canvasesRoot, setCanvasesRoot] = useState<HTMLDivElement | null>(null);
  const { width: trackOccupancyWidth, height: trackOccupancyHeight } = useSize(canvasesRoot);
  const timeOrigin = +new Date('2024/04/02');
  const timeScale = 60000 / xZoomLevel;
  const swapAxis = undefined;
  const hideGrid = undefined;
  const hidePathsLabels = undefined;
  const enableSnapping = undefined;
  const showTicks = true;
  const fullTheme: SpaceTimeChartTheme = {
    ...DEFAULT_THEME,
    background: 'transparent',
    timeGraduationsStyles: {
      ...DEFAULT_THEME.timeGraduationsStyles,
      1: { ...DEFAULT_THEME.timeGraduationsStyles[1], color: 'transparent' },
    },
  };
  const operationalPoints = useMemo(() => (emptyData ? [] : OPERATIONAL_POINTS), [emptyData]);
  const spaceScales = useMemo(() => {
    if (emptyData) {
      return [];
    }

    return operationalPoints.slice(0, -1).map((point, i) => ({
      from: point.position,
      to: operationalPoints[i + 1].position,
      ...(spaceScaleType === 'linear'
        ? { size: 50 * yZoomLevel }
        : { coefficient: 150 / yZoomLevel }),
    }));
  }, [emptyData, operationalPoints, spaceScaleType, yZoomLevel]);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        width,
        height,
        spaceOrigin,
        spaceScales,
        timeOrigin,
        timeScale,
        xOffset,
        yOffset,
        swapAxis,
        hideGrid,
        hidePathsLabels,
        showTicks,
      }),
    [
      width,
      height,
      spaceOrigin,
      spaceScales,
      timeOrigin,
      timeScale,
      xOffset,
      yOffset,
      swapAxis,
      hideGrid,
      hidePathsLabels,
      showTicks,
    ]
  );

  // TODO: when occupancyZones layer and zoom/pan are implemented, clean all unneeded variables from contextState, variables declared before contextState, and props. If needed, create a new context type.
  const contextState: SpaceTimeChartContextType = useMemo(() => {
    const spaceScaleTree = spaceScalesToBinaryTree(spaceOrigin, spaceScales);
    const timeAxis = !swapAxis ? 'x' : 'y';
    const spaceAxis = !swapAxis ? 'y' : 'x';

    // Data translation helpers:
    let timePixelOffset;
    let spacePixelOffset;

    if (!swapAxis) {
      timePixelOffset = xOffset;
      spacePixelOffset = yOffset;
    } else {
      timePixelOffset = yOffset;
      spacePixelOffset = xOffset;
    }

    const getTimePixel = getTimeToPixel(timeOrigin, timePixelOffset, timeScale);
    const getSpacePixel = getSpaceToPixel(spacePixelOffset, spaceScaleTree);
    const getPoint = getDataToPoint(getTimePixel, getSpacePixel, timeAxis, spaceAxis);
    const getTime = getPixelToTime(timeOrigin, timePixelOffset, timeScale);
    const getSpace = getPixelToSpace(spacePixelOffset, spaceScaleTree);
    const getData = getPointToData(getTime, getSpace, timeAxis, spaceAxis);

    const pickingElements: PickingElement[] = [];
    const resetPickingElements = () => {
      pickingElements.length = 0;
    };
    const registerPickingElement = (element: PickingElement) => {
      pickingElements.push(element);
      return pickingElements.length - 1;
    };

    return {
      fingerprint,
      width,
      height,
      trackOccupancyHeight,
      trackOccupancyWidth,
      getTimePixel,
      getSpacePixel,
      getPoint,
      getTime,
      getSpace,
      getData,
      pickingElements,
      resetPickingElements,
      registerPickingElement,
      operationalPoints,
      tracks,
      occupancyZones,
      spaceOrigin,
      spaceScaleTree,
      timeOrigin,
      timeScale,
      timePixelOffset,
      spacePixelOffset,
      timeAxis,
      spaceAxis,
      swapAxis: !!swapAxis,
      enableSnapping: !!enableSnapping,
      hideGrid: !!hideGrid,
      hidePathsLabels: !!hidePathsLabels,
      showTicks: !!showTicks,
      theme: fullTheme,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const [spaceTicksRoot, setSpaceTicksRoot] = useState<HTMLDivElement | null>(null);

  const mouseState = useMouseTracking(root);
  const { position } = mouseState;
  const { canvasContext } = useCanvas(canvasesRoot, contextState, position);
  const { canvasContext: spaceTicksContext } = useCanvas(spaceTicksRoot, contextState, position);

  const mouseContext = useMemo<MouseContextType>(
    () => ({
      isHover: false,
      position: mouseState.position,
      hoveredItem: null,
      data: contextState.getData(mouseState.position),
    }),
    [mouseState.position, contextState]
  );

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const onClick = () => {
    setMousePosition(mouseContext.position);
  };

  useMouseInteractions(canvasesRoot, mouseContext, { onClick }, contextState);
  return (
    <div id="track-occupancy-diagram-base-story" className="bg-ambientB-10">
      <SpaceTimeChartContext.Provider value={contextState}>
        <div className="main-container">
          <div className="bg-ambientB-5 flex flex-col justify-center main-container-header">
            <KebabHorizontal />
          </div>
          <div className="flex">
            <div className="main-container-manchette">
              <TrackOccupancyManchette tracks={tracks} />
            </div>
            <CanvasContext.Provider value={canvasContext}>
              <MouseContext.Provider value={mouseContext}>
                <div className="main-container-canvas">
                  <TrackOccupancyCanvas
                    opId={OP_ID}
                    useDraw={useDraw}
                    setCanvasesRoot={setCanvasesRoot}
                    selectedTrainId={selectedTrainId}
                    setSelectedTrainId={setSelectedTrainId}
                    mousePosition={mousePosition}
                  />
                </div>
              </MouseContext.Provider>
            </CanvasContext.Provider>
          </div>
        </div>
        <CanvasContext.Provider value={spaceTicksContext}>
          <div ref={setRoot} className="relative main-container-time-captions">
            <div ref={setSpaceTicksRoot} className="absolute inset-0">
              <TimeCaptions />
            </div>
          </div>
        </CanvasContext.Provider>
      </SpaceTimeChartContext.Provider>
    </div>
  );
};

const TrackOccupancyDiagramStory = ({ trainId }: { trainId: number }) => {
  const [selectedTrainId, setSelectedTrainId] = useState('0');

  useEffect(() => {
    setSelectedTrainId(`${trainId}`);
  }, [trainId]);

  return (
    <TrackOccupancyDiagram
      xZoomLevel={X_ZOOM_LEVEL}
      yZoomLevel={Y_ZOOM_LEVEL}
      xOffset={0}
      yOffset={0}
      spaceScaleType="linear"
      emptyData={false}
      selectedTrainId={selectedTrainId}
      setSelectedTrainId={setSelectedTrainId}
    />
  );
};

const meta: Meta<typeof TrackOccupancyDiagramStory> = {
  title: 'TrackOccupancyDiagram/Rendering',
  component: TrackOccupancyDiagramStory,
  decorators: [(Story) => <Story />],
  parameters: {
    backgrounds: {
      default: 'lightSand',
      values: [
        {
          name: 'lightSand',
          value: 'rgba(247, 246, 238, var(--tw-bg-opacity, 1))',
        },
      ],
    },
  },
  args: {
    trainId: +SELECTED_TRAIN_ID,
  },
  render: (args) => <TrackOccupancyDiagramStory {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TrackOccupancyDiagramStory>;

export const TrackOccupancyDiagramStoryDefault: Story = {
  args: {
    trainId: 5,
  },
};
