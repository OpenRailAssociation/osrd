import React from 'react';
import cx from 'classnames';

import { LinearMetadataItem } from './data';
import { computeStyleForDataValue, getPositionFromMouseEvent, isNilObject } from './utils';
import { IntervalItemBaseProps } from './types';

interface IntervalItemProps<T> extends IntervalItemBaseProps<T> {
  dragingStartAt: number | null;
  fullLength: number;
  min: number;
  max: number;
  resizing: { index: number | null; startAt: number } | null;
  segment: LinearMetadataItem & { index: number };
  setDraginStartAt: (dragingStartAt: number) => void;
  setHoverAtx: (hoverAtx: number) => void;
  setResizing: (resizing: { index: number | null; startAt: number } | null) => void;
  wrapper: React.MutableRefObject<HTMLDivElement | null>;
}

const IntervalItem = <T extends { [key: string]: string | number }>({
  creating,
  data,
  dragingStartAt,
  emptyValue,
  field,
  fullLength,
  highlighted,
  min,
  max,
  onClick,
  onCreate,
  onDoubleClick,
  onMouseEnter,
  onMouseMove,
  onMouseOver,
  onWheel,
  params,
  resizing,
  segment,
  setDraginStartAt,
  setHoverAtx,
  setResizing,
  wrapper,
}: IntervalItemProps<T>) => (
  <div
    className={cx(
      'item',
      highlighted.includes(segment.index) && 'highlighted',
      field &&
        data[segment.index] !== undefined &&
        data[segment.index][field] !== undefined &&
        data[segment.index][field] !== emptyValue &&
        'with-data',
      field &&
        (data[segment.index] === undefined ||
          data[segment.index][field] === undefined ||
          data[segment.index][field] === emptyValue) &&
        'no-data',
      !field && isNilObject(data[segment.index], ['begin', 'end', 'index']) && 'no-data'
    )}
    style={{
      width: `${((segment.end - segment.begin) / fullLength) * 100}%`,
    }}
    onClick={(e) => {
      if (!dragingStartAt && onClick && data[segment.index]) {
        const item = data[segment.index];
        const point = getPositionFromMouseEvent(e, item);
        onClick(e, item, segment.index, point);
      }
    }}
    onDoubleClick={(e) => {
      if (!dragingStartAt && onDoubleClick && data[segment.index]) {
        const item = data[segment.index];
        const point = getPositionFromMouseEvent(e, item);
        onDoubleClick(e, item, segment.index, point);
      }
    }}
    onMouseOver={(e) => {
      if (!dragingStartAt) {
        // handle mouse over
        if (onMouseOver && data[segment.index]) {
          const item = data[segment.index];
          const point = getPositionFromMouseEvent(e, item);
          onMouseOver(e, item, segment.index, point);
        }
      }
    }}
    onFocus={() => undefined}
    role="button"
    tabIndex={0}
    onMouseMove={(e) => {
      // display vertical bar when hover element
      setHoverAtx(e.clientX - (wrapper.current ? wrapper.current.getBoundingClientRect().x : 0));

      if (!dragingStartAt && onMouseMove && data[segment.index]) {
        const item = data[segment.index];
        const point = getPositionFromMouseEvent(e, item);
        onMouseMove(e, item, segment.index, point);
      }
    }}
    onMouseEnter={(e) => {
      if (!dragingStartAt && onMouseEnter && data[segment.index]) {
        const item = data[segment.index];
        const point = getPositionFromMouseEvent(e, item);
        onMouseEnter(e, item, segment.index, point);
      }
    }}
    onMouseDown={(e) => {
      if (onCreate && creating) {
        const item = data[segment.index];
        const point = getPositionFromMouseEvent(e, item);
        onCreate(point);
        setResizing({ index: segment.index + 1, startAt: e.clientX });
      } else {
        // TODO use the frag tool context here
        setDraginStartAt(e.clientX);
      }
      e.stopPropagation();
      e.preventDefault();
    }}
    onWheel={(e) => {
      if (!dragingStartAt && onWheel && data[segment.index]) {
        const item = data[segment.index];
        const point = getPositionFromMouseEvent(e, item);
        onWheel(e, item, segment.index, point);
      }
    }}
  >
    {/* Create an inner div for the Y axis */}
    {field &&
      data[segment.index] !== undefined &&
      data[segment.index][field] !== undefined &&
      data[segment.index][field] !== emptyValue && (
        <div
          className="value"
          style={computeStyleForDataValue(
            data[segment.index][field],
            min,
            max,
            params?.stringValues
          )}
        >
          {params?.showValues && <span>{data[segment.index][field]}</span>}
        </div>
      )}
    {!field && !isNilObject(data[segment.index], ['begin', 'end', 'index']) && (
      <span className="value" style={{ height: '100%' }} />
    )}

    {/* Create a div for the resize */}
    {data[segment.index] && segment.end === data[segment.index].end && (
      <div
        title="Resize"
        aria-label="Resize"
        className={cx('resize', resizing && resizing.index === segment.index && 'selected')}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          setResizing({ index: segment.index, startAt: e.clientX });
          e.stopPropagation();
          e.preventDefault();
        }}
        role="button"
        tabIndex={-1}
      />
    )}
  </div>
);

export default IntervalItem;
