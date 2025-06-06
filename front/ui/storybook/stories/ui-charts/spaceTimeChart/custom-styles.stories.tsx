import React, { useState } from 'react';

import { PathLayer, SpaceTimeChart, type Point } from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';
import cx from 'classnames';

import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import {
  MAX_X_ZOOM,
  MAX_Y_ZOOM,
  MIN_X_ZOOM,
  MIN_Y_ZOOM,
  X_ZOOM_LEVEL,
  Y_ZOOM_LEVEL,
  getDiff,
} from './helpers/utils';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

const DEFAULT_COLOR_1 = '#FF511A';
const DEFAULT_COLOR_2 = '#FF8B61';
const DEFAULT_COLOR_3 = '#FFEBE1';

type WrapperProps = {
  color1: string;
  color2: string;
  color3: string;
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at showcasing how to customize inside styles.
 */
const Wrapper = ({ color1, color2, color3, spaceScaleType }: WrapperProps) => {
  const [state, setState] = useState<{
    xOffset: number;
    yOffset: number;
    xZoomLevel: number;
    yZoomLevel: number;
    panning: null | { initialOffset: Point };
  }>({
    xOffset: 0,
    yOffset: 0,
    xZoomLevel: X_ZOOM_LEVEL,
    yZoomLevel: Y_ZOOM_LEVEL,
    panning: null,
  });

  return (
    <div className="absolute inset-0">
      <SpaceTimeChart
        className={cx('h-full p-0 m-0', state.panning && 'cursor-grabbing')}
        operationalPoints={OPERATIONAL_POINTS}
        spaceOrigin={0}
        spaceScales={OPERATIONAL_POINTS.slice(0, -1).map((point, i) => ({
          from: point.position,
          to: OPERATIONAL_POINTS[i + 1].position,
          ...(spaceScaleType === 'linear'
            ? { size: 50 * state.yZoomLevel }
            : { coefficient: 150 / state.yZoomLevel }),
        }))}
        timeOrigin={+new Date('2024/04/02')}
        timeScale={60000 / state.xZoomLevel}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        onPan={({ initialPosition, position, isPanning }) => {
          const diff = getDiff(initialPosition, position);
          setState((s) => {
            // Stop panning:
            if (!isPanning) {
              return { ...s, panning: null };
            }
            // Start panning:
            else if (!s.panning) {
              return {
                ...s,
                panning: {
                  initialOffset: {
                    x: s.xOffset,
                    y: s.yOffset,
                  },
                },
              };
            }
            // Keep panning:
            else {
              const { initialOffset } = s.panning;
              return {
                ...s,
                xOffset: initialOffset.x + diff.x,
                yOffset: initialOffset.y + diff.y,
              };
            }
          });
        }}
        onZoom={({ delta, position: { x, y } }) => {
          setState((s) => {
            const newState = { ...s };

            newState.xZoomLevel = Math.min(
              Math.max(newState.xZoomLevel * (1 + delta / 10), MIN_X_ZOOM),
              MAX_X_ZOOM
            );
            newState.yZoomLevel = Math.min(
              Math.max(newState.yZoomLevel * (1 + delta / 10), MIN_Y_ZOOM),
              MAX_Y_ZOOM
            );

            // These line is to center the zoom on the mouse Y position:
            newState.xOffset = x - ((x - s.xOffset) / s.xZoomLevel) * newState.xZoomLevel;
            newState.yOffset = y - ((y - s.yOffset) / s.yZoomLevel) * newState.yZoomLevel;

            return newState;
          });
        }}
        theme={{
          background: color3,
          pathsStyles: {
            fontSize: 16,
            fontFamily: 'sans-serif',
          },
          spaceGraduationsStyles: {
            1: {
              width: 0.5,
              color: color1,
              opacity: 0.75,
            },
            2: {
              width: 0.5,
              color: color1,
              opacity: 0.25,
            },
            3: {
              width: 0.5,
              color: color2,
            },
          },
          timeCaptionsStyles: {
            1: {
              color: color1,
              font: `12px sans-serif`,
              topOffset: 11,
            },
            2: {
              color: color2,
              font: `12px sans-serif`,
              topOffset: 9,
            },
            3: {
              color: color2,
              font: `10px sans-serif`,
              topOffset: 6,
            },
            4: {
              color: color2,
              font: `8px sans-serif`,
              topOffset: 8,
            },
          },
          timeGraduationsStyles: {
            1: {
              width: 0.5,
              color: color1,
            },
            2: {
              width: 0.5,
              color: color1,
              opacity: 0.77,
            },
            3: {
              width: 0.5,
              color: color1,
              opacity: 0.5,
            },
            4: {
              width: 0.5,
              color: color1,
              opacity: 0.5,
              dashArray: [6, 6],
            },
            5: {
              width: 0.5,
              color: color1,
              opacity: 0.5,
              dashArray: [6, 18],
            },
            6: {
              width: 1,
              color: color1,
              opacity: 0.5,
              dashArray: [1, 12],
            },
          },
        }}
      >
        {PATHS.map((path) => (
          <PathLayer
            key={path.id}
            path={path}
            color={path.color}
            border={path.border}
            level={path.level || 2}
          />
        ))}
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Customize theme',
  component: Wrapper,
  argTypes: {
    color1: {
      name: 'Primary color',
      defaultValue: DEFAULT_COLOR_1,
      control: { type: 'color' },
    },
    color2: {
      name: 'Secondary color',
      defaultValue: DEFAULT_COLOR_2,
      control: { type: 'color' },
    },
    color3: {
      name: 'Background color',
      defaultValue: DEFAULT_COLOR_3,
      control: { type: 'color' },
    },
    spaceScaleType: {
      name: 'Space scaling type',
      options: ['linear', 'proportional'],
      defaultValue: 'linear',
      control: { type: 'radio' },
    },
  },
} as Meta<typeof Wrapper>;

export const DefaultArgs = {
  name: 'Default arguments',
  args: {
    color1: DEFAULT_COLOR_1,
    color2: DEFAULT_COLOR_2,
    color3: DEFAULT_COLOR_3,
    spaceScaleType: 'linear',
  },
};
