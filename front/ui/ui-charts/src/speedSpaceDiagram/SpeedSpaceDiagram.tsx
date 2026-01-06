import React, { useMemo, useState, type ReactNode } from 'react';

import cx from 'classnames';

import { SpeedSpaceDiagramCanvasContext, SpeedSpaceDiagramContext } from './context';
import type { SpeedSpaceDiagramContextType } from './types';
import { useCanvas } from '../common/useCanvas';
import { useMouseTracking } from '../spaceTimeChart/hooks/useMouseTracking';
import { MouseContext } from '../spaceTimeChart/lib/context';
import type { MouseContextType } from '../spaceTimeChart/lib/types';

export type SpeedSpaceDiagramProps = {
  width: number;
  height: number;
  background: string;
  speedScale: number;
  spaceOrigin: number;
  spaceScale: number;
  children?: ReactNode | ReactNode[];
};

const SpeedSpaceDiagram = ({
  children,
  width,
  height,
  speedScale,
  spaceOrigin,
  spaceScale,
  background,
}: SpeedSpaceDiagramProps) => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [canvasesRoot, setCanvasesRoot] = useState<HTMLDivElement | null>(null);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        width,
        height,
        speedScale,
        spaceOrigin,
        spaceScale,
        background,
      }),
    [width, height, speedScale, spaceOrigin, spaceScale, background]
  );

  const contextState: SpeedSpaceDiagramContextType = useMemo(
    () => ({
      fingerprint,
      width,
      height,
      speedScale,
      spaceOrigin,
      spaceScale,
      theme: { background },
      pickingElements: [],
      resetPickingElements: () => {},
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint]
  );

  const { canvasContext, hoveredItem } = useCanvas(canvasesRoot, contextState);

  const mouseState = useMouseTracking(root);

  const mouseContext = useMemo<MouseContextType>(
    () => ({
      ...mouseState,
      hoveredItem: hoveredItem,
      data: { time: 0, position: 0 },
    }),
    [mouseState, hoveredItem]
  );

  // Handle interactions:
  // useMouseInteractions(root, mouseContext, { onPan, onZoom, onClick, onMouseMove }, contextState);

  return (
    <div ref={setRoot} className={cx('relative speed-space-diagram-2')} style={{ background }}>
      <div ref={setCanvasesRoot} className="absolute inset-0" />
      <SpeedSpaceDiagramContext.Provider value={contextState}>
        <SpeedSpaceDiagramCanvasContext.Provider value={canvasContext}>
          <MouseContext.Provider value={mouseContext}>{children}</MouseContext.Provider>
        </SpeedSpaceDiagramCanvasContext.Provider>
      </SpeedSpaceDiagramContext.Provider>
    </div>
  );
};

export default SpeedSpaceDiagram;
