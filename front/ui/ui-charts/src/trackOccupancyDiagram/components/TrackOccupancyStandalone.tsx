import React, { useEffect, useMemo, useRef, useState } from 'react';

import { KebabHorizontal } from '@osrd-project/ui-icons';

import { TRACK_HEIGHT_CONTAINER } from '../lib/consts';
import OccupancyZonesLayer, { isOccupancyPickingElement } from './layers/OccupancyZonesLayer';
import TrackOccupancyManchette from './TrackOccupancyManchette';
import type { HoveredItem, PickingElement } from '../../common/types';
import { useCanvas } from '../../common/useCanvas';
import { useManchetteWithSpaceTimeChart } from '../../manchette';
import { DEFAULT_THEME, MouseContext } from '../../spaceTimeChart';
import { useMouseInteractions } from '../../spaceTimeChart/hooks/useMouseInteractions';
import { useMouseTracking } from '../../spaceTimeChart/hooks/useMouseTracking';
import { HOUR } from '../../spaceTimeChart/lib/consts';
import type { Handler, MouseContextType } from '../../spaceTimeChart/lib/types';
import {
  getTimeToPixel,
  getDataToPoint,
  getPixelToTime,
  getPixelToSpace,
  getPointToData,
  getSpaceToPixel,
  spaceScalesToBinaryTree,
} from '../../spaceTimeChart/utils/scales';
import { snapPosition } from '../../spaceTimeChart/utils/snapping';
import { TrackOccupancyCanvasContext } from '../lib/context';
import type { OccupancyZone, Track, TrackOccupancyDiagramContextType } from '../lib/types';
import TracksLayer from './layers/TracksLayer';

type TrackOccupancyStandaloneProps = {
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  selectedTrainId?: string;
  width: number;
  height: number;
  onSelectedTrainIdChange?: (selectedTrainId?: string) => void;
  onHoveredChildUpdate?: Handler<{
    item: HoveredItem | null;
    context: TrackOccupancyDiagramContextType;
  }>;
};

const TrackOccupancyStandalone = ({
  tracks,
  occupancyZones,
  selectedTrainId,
  height = TRACK_HEIGHT_CONTAINER * tracks.length + DEFAULT_THEME.timeCaptionsSize,
  width,
  onSelectedTrainIdChange,
  onHoveredChildUpdate,
}: TrackOccupancyStandaloneProps) => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [canvasesRoot, setCanvasesRoot] = useState<HTMLDivElement | null>(null);

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);
  const defaultTimeOrigin = useMemo(() => {
    const minTime = Math.min(...(occupancyZones.map((zone) => zone.startTime) || Date.now()));
    // Take first round hour before minTime:
    return Math.floor(minTime / HOUR) * HOUR;
  }, [occupancyZones]);

  /**
   * We now use useManchetteWithSpaceTimeChart, to get proper pan along the time (and space axis if
   * the container is smaller than the contents):
   */
  const {
    spaceTimeChartProps: {
      spaceOrigin,
      spaceScales,
      timeOrigin,
      timeScale,
      xOffset = 0,
      yOffset = 0,
      hideTimeCaptions,
      hideDates,
      theme,
    },
    handleScroll,
  } = useManchetteWithSpaceTimeChart({
    waypoints: [
      {
        id: 'FAKE_WAYPOINT_1',
        position: 0,
      },
    ],
    manchetteWithSpaceTimeChartRef,
    height,
    spaceTimeChartRef,
    defaultTimeOrigin,
    verticalPadding: 0,
    options: {
      displayTimeCaptions: true,
      enableTimePan: true,
      enableSpacePan: true,
      enableTimeZoom: false,
    },
  });

  const onClick = ({ hoveredItem }: { hoveredItem: HoveredItem | null }) => {
    if (hoveredItem?.layer === 'overlay' && isOccupancyPickingElement(hoveredItem.element)) {
      const newId = hoveredItem.element.pathId;
      onSelectedTrainIdChange?.(newId === selectedTrainId ? undefined : newId);
    } else {
      onSelectedTrainIdChange?.(undefined);
    }
  };

  const fullTheme = useMemo(() => ({ ...DEFAULT_THEME, ...theme }), [theme]);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        width,
        height,
        timeOrigin,
        timeScale,
        xOffset,
        hideTimeCaptions,
        hideDates,
      }),
    [width, height, timeOrigin, timeScale, xOffset, hideTimeCaptions, hideDates]
  );

  const contextState: TrackOccupancyDiagramContextType = useMemo(() => {
    const timeAxis = 'x';
    const spaceAxis = 'y';

    const spaceScaleTree = spaceScalesToBinaryTree(spaceOrigin, spaceScales);

    // Data translation helpers:
    const timePixelOffset = xOffset;
    const spacePixelOffset = yOffset;

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
      getTimePixel,
      getSpacePixel,
      getPoint,
      getTime,
      getSpace,
      getData,
      pickingElements,
      resetPickingElements,
      registerPickingElement,
      timeScale,
      theme: fullTheme,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const mouseState = useMouseTracking(root);
  const { position, down, isHover } = mouseState;
  const { canvasContext, hoveredItem } = useCanvas(
    canvasesRoot,
    contextState,
    contextState.fingerprint,
    position
  );

  const mouseContext = useMemo<MouseContextType>(() => {
    const snappedPosition = snapPosition(mouseState.position, hoveredItem);

    return {
      down,
      isHover,
      position: snappedPosition,
      hoveredItem: hoveredItem,
      data: contextState.getData(snappedPosition),
    };
  }, [mouseState.position, hoveredItem, down, isHover, contextState]);

  // Handle interactions:
  useMouseInteractions<TrackOccupancyDiagramContextType>(
    root,
    mouseContext,
    { onClick },
    contextState
  );
  // interactions à rajouter au-dessus

  // Handle onHoveredChildUpdate:
  useEffect(() => {
    if (onHoveredChildUpdate) {
      onHoveredChildUpdate({ item: hoveredItem, context: contextState });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredItem]);

  return (
    <div className="ui-track-occupancy-standalone">
      <div className="bg-ambientB-5 flex flex-col justify-center main-container-header grow-0 shrink-0">
        {/* TODO: Bind actions? */}
        <KebabHorizontal />
      </div>
      <div
        className="track-occupancy-wrapper"
        style={{ maxHeight: height, height, overflow: 'auto', display: 'flex', width: '100%' }}
        onScroll={handleScroll}
        ref={setRoot}
      >
        <div style={{ width: '200px'}}>
          <TrackOccupancyManchette tracks={tracks} />
        </div>
        <div className="relative" style={{ width: 'calc(100% - 200px)' }}>
          <TrackOccupancyCanvasContext.Provider value={canvasContext}>
            <MouseContext.Provider value={mouseContext}>
              <div ref={setCanvasesRoot} className="absolute inset-0" />
              <TracksLayer position={0} tracks={tracks} topPadding={0} drawBorders={false} />
              <OccupancyZonesLayer
                tracks={tracks}
                position={0}
                topPadding={0}
                occupancyZones={occupancyZones}
                selectedTrainId={selectedTrainId}
              />
            </MouseContext.Provider>
          </TrackOccupancyCanvasContext.Provider>
        </div>
      </div>
    </div>
  );
};

export default TrackOccupancyStandalone;
