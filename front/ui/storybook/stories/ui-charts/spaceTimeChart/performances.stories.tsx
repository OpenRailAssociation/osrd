import React, { useMemo, useState } from 'react';

import {
  SpaceTimeChart,
  PathLayer,
  type OperationalPoint,
  type Point,
} from '@osrd-project/ui-charts';
import { type Meta } from '@storybook/react-vite';
import cx from 'classnames';
import { random, range } from 'lodash';

import { KILOMETER, MINUTE } from './helpers/consts';
import { getPaths, type PATHS } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL, zoom, getDiff } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

const DATE_OFFSET = +new Date('2024/01/01');
const COLORS = [
  '#9E8256',
  '#FF362E',
  '#FF8E3D',
  '#FFBF00',
  '#95C877',
  '#78E6C5',
  '#66C0F1',
  '#526CE8',
  '#D16DBC',
  '#FF9BC6',
];

type WrapperProps = {
  operationalPointsCount: number;
  trainTypes: number;
  pathsPerTrain: number;
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at testing the performances of the SpaceTimeChart component when rendering a
 * high number of paths.
 */
const Wrapper = ({
  operationalPointsCount,
  trainTypes,
  pathsPerTrain,
  spaceScaleType,
}: WrapperProps) => {
  const operationalPoints: OperationalPoint[] = useMemo(() => {
    let position = 0;
    return range(operationalPointsCount).map((i) => ({
      id: `op-${i}`,
      label: `Operational point n°${i + 1}`,
      position: (position += random(50 * KILOMETER, 150 * KILOMETER)),
      importanceLevel: !i || i === operationalPointsCount - 1 || Math.random() > 0.8 ? 1 : 2,
    }));
  }, [operationalPointsCount]);
  const paths: typeof PATHS = useMemo(() => {
    const allOP = operationalPoints;
    const mainOP = allOP.filter((p) => p.importanceLevel === 1);
    const reversedAllOP = allOP.slice(0).reverse();
    const reversedMainOP = mainOP.slice(0).reverse();
    return range(trainTypes).flatMap((trainTypeIndex) => {
      const isReversed = trainTypeIndex % 2;
      const isOmnibus = Math.floor(trainTypeIndex / 2) % 2;
      const speedRatio = Math.floor(trainTypeIndex / 2) / Math.floor(trainTypes / 2);
      const speed = ((100 + 100 * speedRatio) * KILOMETER) / (60 * MINUTE);
      return getPaths(
        `type n°${trainTypeIndex}`,
        isOmnibus ? (isReversed ? reversedAllOP : allOP) : isReversed ? reversedMainOP : mainOP,
        5 * MINUTE,
        (30 + trainTypeIndex * 5) * MINUTE,
        speed,
        pathsPerTrain,
        DATE_OFFSET,
        {
          color: COLORS[trainTypeIndex % COLORS.length],
          fromEnd: isOmnibus ? 'out' : 'stop',
          toEnd: isOmnibus ? 'out' : 'stop',
        }
      );
    });
  }, [operationalPoints, trainTypes, pathsPerTrain]);
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
        operationalPoints={operationalPoints}
        spaceOrigin={0}
        spaceScales={operationalPoints.slice(0, -1).map((point, i) => ({
          from: point.position,
          to: operationalPoints[i + 1].position,
          ...(spaceScaleType === 'linear'
            ? { size: 50 * state.yZoomLevel }
            : { coefficient: 150 / state.yZoomLevel }),
        }))}
        timeOrigin={DATE_OFFSET}
        timeScale={MINUTE / state.xZoomLevel}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        onPan={({ initialPosition, position, isPanning }) => {
          const { panning } = state;
          const diff = getDiff(initialPosition, position);
          setState((prev) => {
            // Stop panning:
            if (!isPanning) {
              return { ...prev, panning: null };
            }
            // Start panning:
            else if (!panning) {
              return {
                ...prev,
                panning: {
                  initialOffset: {
                    x: state.xOffset,
                    y: state.yOffset,
                  },
                },
              };
            }
            // Keep panning:
            else {
              const xOffset = panning.initialOffset.x + diff.x;
              const yOffset = panning.initialOffset.y + diff.y;

              return {
                ...state,
                xOffset,
                yOffset,
              };
            }
          });
        }}
        onZoom={(payload) => {
          setState((prev) => ({
            ...prev,
            ...zoom(state, payload),
          }));
        }}
      >
        {paths.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Performances',
  component: Wrapper,
  argTypes: {
    operationalPointsCount: {
      name: 'Operational points',
      defaultValue: 5,
      control: { type: 'number', step: 1, min: 2, max: 30 },
    },
    trainTypes: {
      name: 'Train types',
      defaultValue: 4,
      control: { type: 'number', step: 1, min: 1, max: 20 },
    },
    pathsPerTrain: {
      name: 'Paths per train type',
      defaultValue: 50,
      control: { type: 'number', step: 10, min: 0, max: 200 },
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
    operationalPointsCount: 5,
    trainTypes: 4,
    pathsPerTrain: 50,
    spaceScaleType: 'linear',
  },
};
