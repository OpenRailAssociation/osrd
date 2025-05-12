import React, { useContext } from 'react';

import {
  MouseContext,
  SpaceTimeChartContext,
  type DataPoint,
  type Point,
  positionMmToKm,
} from '@osrd-project/ui-charts';

import { WHITE_75 } from './consts';
import { formatTimeLength } from './utils';

/**
 * This component draws a dashed line from p1 to p2, using SVG:
 */
export const Line = ({ p1, p2 }: { p1: Point; p2: Point }) => (
  <svg width="100%" height="100%">
    <line
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="black"
      strokeWidth="1"
      strokeDasharray="5, 5"
    />
  </svg>
);

const CROSS_SIZE = 11;
const Cross = ({ size = CROSS_SIZE }: { size?: number }) => (
  <>
    <div
      style={{
        position: 'absolute',
        width: size,
        height: 1,
        left: -size / 2,
        top: -0.5,
        background: 'black',
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: 1,
        height: size,
        left: -0.5,
        top: -size / 2,
        background: 'black',
      }}
    />
  </>
);

/**
 * This component renders a data label, to help bring context to the SpaceTimeChart:
 */
const DataLabel = ({
  data,
  position,
  isDiff,
  marginTop = 0,
  shiftTextX = 0,
  shiftTextY = 0,
}: {
  data: DataPoint;
  position: Point;
  isDiff?: boolean;
  marginTop?: number;
  shiftTextX?: number;
  shiftTextY?: number;
}) => (
  <div
    style={{
      position: 'absolute',
      top: position.y,
      left: position.x,
      paddingTop: marginTop,
      whiteSpace: 'nowrap',
      fontSize: '0.7em',
    }}
  >
    <Cross />
    <div
      className="content"
      style={{ background: WHITE_75, marginTop: `${shiftTextY}px`, marginLeft: `${shiftTextX}px` }}
    >
      {isDiff ? (
        <>
          <div>Time difference: {formatTimeLength(new Date(data.time))}</div>
          <div>Distance to mark: {positionMmToKm(data.position).toLocaleString()} km</div>
        </>
      ) : (
        <>
          <div>Time: {new Date(data.time).toLocaleTimeString()}</div>
          <div>Distance: {positionMmToKm(data.position).toLocaleString()} km</div>
        </>
      )}
    </div>
  </div>
);

/**
 * This component renders a DataLabel under the mouse, using the MouseContext from the SpaceTimeChart:
 */
export const MouseTracker = ({ reference }: { reference?: DataPoint }) => {
  const { getPoint, width, height } = useContext(SpaceTimeChartContext);
  const { position, data, isHover } = useContext(MouseContext);

  return isHover ? (
    <>
      {!!reference && <Line p1={position} p2={getPoint(reference)} />}
      {!!reference && <DataLabel data={reference} position={getPoint(reference)} marginTop={5} />}
      <DataLabel
        data={
          reference
            ? {
                position: data.position - reference.position,
                time: data.time - reference.time,
              }
            : data
        }
        position={position}
        isDiff={!!reference}
        shiftTextX={position.x > width - 100 ? -100 : 10}
        shiftTextY={position.y > height - 50 ? -50 : 20}
      />
    </>
  ) : null;
};
