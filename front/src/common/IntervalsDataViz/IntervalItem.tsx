import cx from 'classnames';

import { INTERVAL_TYPES } from 'common/IntervalsEditor/types';

import type { IntervalItemBaseProps, LinearMetadataItem } from './types';
import {
  computeStyleForDataValue,
  getPositionFromMouseEventAndSegment,
  isNilObject,
} from './utils';

interface IntervalItemProps<T> extends IntervalItemBaseProps<T> {
  dragingStartAt: number | null;
  fullLength: number;
  min: number;
  max: number;
  resizing: { index: number | null; startAt: number } | null;
  segment: LinearMetadataItem & { index: number };
  setDraginStartAt: (dragingStartAt: number) => void;
  setResizing: (
    resizing: { index: number | null; startAt: number; startPosition: number } | null
  ) => void;
}

const IntervalItem = <T extends { [key: string]: string | number }>({
  creating,
  data,
  dragingStartAt,
  emptyValue,
  field,
  fullLength,
  highlighted,
  intervalType,
  min,
  max,
  onClick,
  onCreate,
  onDoubleClick,
  onMouseEnter,
  onMouseOver,
  onWheel,
  options,
  resizing,
  segment,
  setDraginStartAt,
  setResizing,
  disableDrag = true,
}: IntervalItemProps<T>) => {
  let valueText = '';
  if (field && segment[field]) {
    const interval = segment;
    if (intervalType === INTERVAL_TYPES.NUMBER_WITH_UNIT) {
      valueText = `${interval[field]} ${
        intervalType === INTERVAL_TYPES.NUMBER_WITH_UNIT && interval.unit
      }`;
    } else {
      valueText = `${interval[field]}`;
    }
  }

  const hasNoData =
    !!field &&
    (segment === undefined || segment[field] === undefined || segment[field] === emptyValue);
  const hasData =
    !!field &&
    segment !== undefined &&
    segment[field] !== undefined &&
    segment[field] !== emptyValue;
  const fieldValue = !!field && segment !== undefined && segment[field];
  const isDataZero = fieldValue === 0;

  return (
    <div
      className={cx(
        'item',
        highlighted.includes(segment.index) && 'highlighted',
        {
          'with-data': hasData,
          'no-data': hasNoData,
        },
        !field && isNilObject(segment, ['begin', 'end', 'index']) && 'no-data'
      )}
      style={{
        width: `${((segment.end - segment.begin) / fullLength) * 100}%`,
      }}
      onClick={(e) => {
        if (!dragingStartAt && onClick && data[segment.index]) {
          const item = data[segment.index];
          const point = getPositionFromMouseEventAndSegment(e, item);
          onClick(e, item, segment.index, point);
        }
      }}
      onDoubleClick={(e) => {
        if (!dragingStartAt && onDoubleClick && data[segment.index]) {
          const item = data[segment.index];
          const point = getPositionFromMouseEventAndSegment(e, item);
          onDoubleClick(e, item, segment.index, point);
        }
      }}
      onMouseOver={(e) => {
        if (!dragingStartAt) {
          // handle mouse over
          if (onMouseOver && data[segment.index]) {
            const item = data[segment.index];
            const point = getPositionFromMouseEventAndSegment(e, item);
            onMouseOver(e, item, segment.index, point);
          }
        }
      }}
      onFocus={() => undefined}
      role="button"
      tabIndex={0}
      onMouseEnter={(e) => {
        if (!dragingStartAt && onMouseEnter && data[segment.index]) {
          const item = data[segment.index];
          const point = getPositionFromMouseEventAndSegment(e, item);
          onMouseEnter(e, item, segment.index, point);
        }
      }}
      onMouseDown={(e) => {
        if (onCreate && creating) {
          const item = data[segment.index];
          const point = getPositionFromMouseEventAndSegment(e, item);
          onCreate(point);
          setResizing({ index: segment.index + 1, startAt: e.clientX, startPosition: point + 1 });
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
          const point = getPositionFromMouseEventAndSegment(e, item);
          onWheel(e, item, segment.index, point);
        }
      }}
    >
      {/* Create an inner div for the Y axis */}
      {field &&
        segment !== undefined &&
        segment[field] !== undefined &&
        segment[field] !== emptyValue && (
          <div
            className="value"
            style={computeStyleForDataValue(segment[field], min, max, options?.fullHeightItem)}
          >
            {options?.showValues && <span>{valueText}</span>}
          </div>
        )}
      {!field && !isNilObject(segment, ['begin', 'end', 'index']) && (
        <span className="value" style={{ height: '100%' }} />
      )}

      {hasNoData && <div className="no-data-line" style={computeStyleForDataValue(0, min, max)} />}
      {isDataZero && <div className="zero-line" style={computeStyleForDataValue(0, min, max)} />}

      {/* Create a div for the resize */}
      {data[segment.index] && segment.end === data[segment.index].end && (
        <div
          title={!disableDrag ? 'Resize' : 'Interval boundary'}
          aria-label={!disableDrag ? 'Resize' : 'Interval boundary'}
          className={cx('resize', {
            selected: resizing && resizing.index === segment.index,
            disabled: disableDrag,
          })}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseDown={(e) => {
            if (!disableDrag) {
              setResizing({ index: segment.index, startAt: e.clientX, startPosition: segment.end });
            }
            e.stopPropagation();
            e.preventDefault();
          }}
          role="button"
          tabIndex={-1}
        />
      )}
    </div>
  );
};

export default IntervalItem;
