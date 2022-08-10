import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { head, last, maxBy, minBy } from 'lodash';
import cx from 'classnames';
import shortNumber from 'short-number';

import { roundNumber, preventDefault, isNilObject } from './utils';
import { LinearMetadataItem, cropForDatavizViewbox } from './data';
import './style.scss';

/**
 * Function that compute the div style attribut for a data value.
 */
function computeStyleForDataValue(value: number, min: number, max: number): CSSProperties {
  if (min < 0) {
    const negativeAreaHeightRatio = Math.abs(min / (max - min));
    const dataHeight = Math.abs(value / (max - min));
    return {
      height: `${dataHeight * 100}%`,
      bottom: `${
        (value >= 0 ? negativeAreaHeightRatio : negativeAreaHeightRatio - dataHeight) * 100
      }%`,
      position: 'relative',
    };
  }
  return {
    height: `${((value - min) / (max - min)) * 100}%`,
  };
}

/**
 * Get the linear metadata mouse position from a react event.
 */
function getPositionFromMouseEvent(
  event: React.MouseEvent<HTMLDivElement>,
  segment: LinearMetadataItem
): number {
  const target = event.target as HTMLDivElement;
  if (target.className.includes('resize')) return segment.end;
  const pxOffset = event.nativeEvent.offsetX;
  const pxSize = target.offsetWidth;
  return Math.round(segment.begin + (pxOffset / pxSize) * (segment.end - segment.begin));
}

const Scale: React.FC<{
  className?: string;
  begin: number;
  end: number;
  min?: number;
  max?: number;
}> = ({ className, begin, end, min, max }) => {
  const [inf, setInf] = useState<number>(0);
  const [sup, setSup] = useState<number>(0);

  useEffect(() => {
    setInf(roundNumber(begin, true));
    setSup(roundNumber(end, false));
  }, [begin, end]);

  return (
    <div className={`scale ${className}`}>
      <span
        className={cx(
          min !== undefined && min === begin && 'font-weight-bold',
          min === undefined && 'font-weight-bold'
        )}
        title={`${inf}`}
      >
        {shortNumber(inf)}
      </span>
      <span
        className={cx(
          max !== undefined && max === end && 'font-weight-bold',
          max === undefined && 'font-weight-bold'
        )}
        title={`${sup}`}
      >
        {shortNumber(sup)}
      </span>
    </div>
  );
};

export interface LinearMetadataDatavizProps<T> {
  /**
   * List of data to display (must be ordered by begin/end)
   */
  data: Array<LinearMetadataItem<T>>;

  /**
   * Name of the field on which we need to do the viz
   */
  field?: string;

  /**
   * List of elements (by begin value) that should be highlighted
   */
  highlighted: Array<number>;

  /**
   * Wich part of the data are visible ?
   */
  viewBox: [number, number] | null;

  /**
   * Event when the mouse move on a data item
   */
  onMouseMove?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event on click on a data item
   */
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event on click on a data item
   */
  onDoubleClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse over a data item
   */
  onMouseOver?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse enter into data item
   */
  onMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse leave into data item
   */
  onMouseLeave?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse wheel on a data item
   */
  onWheel?: (
    e: React.WheelEvent<HTMLDivElement>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when the user is dragging
   */
  onDragX?: (gap: number, finalized: boolean) => void;

  /**
   * Event when the user is resizing an item
   */
  onResize?: (index: number, gap: number, finalized: boolean) => void;
}

/**
 * Component that display a linear metadata of a line.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LinearMetadataDataviz = <T extends any>({
  data,
  field,
  viewBox,
  highlighted = [],
  onClick,
  onDoubleClick,
  onMouseMove,
  onMouseOver,
  onMouseEnter,
  onMouseLeave,
  onWheel,
  onDragX,
  onResize,
}: LinearMetadataDatavizProps<T>) => {
  // Html ref of the div wrapper
  const wrapper = useRef<HTMLDivElement | null>(null);
  // Need to compute the full length of the segment, to compute size in %
  const [fullLength, setFullLength] = useState<number>(0);
  // If the user is doing a drag'n'drop
  const [draginStartAt, setDraginStartAt] = useState<number | null>(null);
  // Store the data for the resizing:
  const [resizing, setResizing] = useState<{ index: number; startAt: number } | null>(null);
  // min & max of the data value
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(0);
  // Computed data for the viz and the viewbox
  const [data4viz, setData4viz] = useState<Array<LinearMetadataItem & { index: number }>>([]);

  /**
   * When data change (or the field)
   * => we recompute the min/max
   */
  useEffect(() => {
    if (field) {
      const dMin = minBy(data, field);
      const dMax = maxBy(data, field);
      setMin(dMin && dMin[field] < 0 ? dMin[field] : 0);
      setMax(dMax && dMax[field] > 0 ? dMax[field] : 0);
    } else {
      setMin(0);
      setMax(0);
    }
  }, [data, field]);

  /**
   * When data or viewbox change
   * => we recompute the data for the viz
   * => we recompute the full length of the displayed data.
   */
  useEffect(() => {
    const nData = cropForDatavizViewbox(data, viewBox);
    setData4viz(nData);
    setFullLength((last(nData)?.end || 0) - (head(nData)?.begin || 0));
  }, [data, viewBox]);

  /**
   * When the wrapper div change
   * => we listen event on it to catch the wheel event and prevent the scroll
   * => we listen for resize to compute its width (used in the drag'n'drop)
   * NOTE: the prevent default directly on the event doesn't work, that's why we need
   * to register it on the ref (@see https://github.com/facebook/react/issues/5845)
   */
  useEffect(() => {
    const element = wrapper.current;
    if (element) element.addEventListener('wheel', preventDefault);
    return () => {
      if (element) element.removeEventListener('wheel', preventDefault);
    };
  }, [wrapper]);

  /**
   * When start to drag
   * => register event on document for the mouseUp & mousemove
   */
  useEffect(() => {
    let fnUp: ((e: MouseEvent) => void) | undefined;
    let fnMove: ((e: MouseEvent) => void) | undefined;

    if (onDragX && draginStartAt && wrapper.current) {
      const wrapperWidth = wrapper.current.offsetWidth;

      // function for key up
      fnUp = (e) => {
        const delta = ((draginStartAt - e.clientX) / wrapperWidth) * fullLength;
        onDragX(delta, true);
        setDraginStartAt(null);
      };
      // function for move
      fnMove = (e) => {
        const delta = ((draginStartAt - e.clientX) / wrapperWidth) * fullLength;
        onDragX(delta, false);
        setDraginStartAt(e.clientX);
      };

      document.addEventListener('mouseup', fnUp, true);
      document.addEventListener('mousemove', fnMove, true);
    }
    // cleanup
    return () => {
      if (fnUp && fnMove) {
        document.removeEventListener('mouseup', fnUp, true);
        document.removeEventListener('mousemove', fnMove, true);
      }
    };
  }, [draginStartAt, onDragX, wrapper, fullLength]);

  /**
   * When resize starts
   * => register event on document for the mouseUp
   */
  useEffect(() => {
    let fnUp: ((e: MouseEvent) => void) | undefined;
    let fnMove: ((e: MouseEvent) => void) | undefined;

    if (onResize && wrapper.current && resizing) {
      const wrapperWidth = wrapper.current.offsetWidth;

      // function for key up
      fnUp = (e) => {
        const delta = ((e.clientX - resizing.startAt) / wrapperWidth) * fullLength;
        setResizing(null);
        onResize(resizing.index, delta, true);
      };
      // function for mouve
      fnMove = (e) => {
        const delta = ((e.clientX - resizing.startAt) / wrapperWidth) * fullLength;
        onResize(resizing.index, delta, false);
      };

      document.addEventListener('mouseup', fnUp, true);
      document.addEventListener('mousemove', fnMove, true);
    }
    // cleanup
    return () => {
      if (fnUp && fnMove) {
        document.removeEventListener('mouseup', fnUp, true);
        document.removeEventListener('mousemove', fnMove, true);
      }
    };
  }, [resizing, onResize, wrapper, fullLength]);

  return (
    <div className={cx('linear-metadata-visualisation')}>
      <div
        ref={wrapper}
        className={cx(
          'data',
          highlighted.length > 0 && 'has-highlight',
          viewBox !== null && draginStartAt && 'dragging',
          resizing && 'resizing',
          (viewBox === null || viewBox[0] === 0) && 'start-visible',
          (viewBox === null || viewBox[1] === last(data)?.end) && 'end-visible'
        )}
      >
        {/* Display the 0 axis if it's necessary */}
        {min < 0 && max > 0 && (
          <div className="axis-zero" style={computeStyleForDataValue(0, min, max)} />
        )}
        {/* Display the Y axis if there is one */}
        {field && min !== max && <Scale className="scale-y" begin={min} end={max} />}

        {/* Create one div per item for the X axis */}
        {data4viz.map((segment) => (
          <div
            key={`${segment.index}-${segment.begin}-${segment.end}-${fullLength}`}
            className={cx(
              'item',
              highlighted.includes(segment.index) && 'highlighted',
              field &&
                (data[segment.index] === undefined || data[segment.index][field] === undefined) &&
                'no-data',
              !field && isNilObject(data[segment.index], ['begin', 'end', 'index']) && 'no-data'
            )}
            style={{
              width: `${((segment.end - segment.begin) / fullLength) * 100}%`,
            }}
            onClick={(e) => {
              if (!draginStartAt && onClick && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onClick(e, item, segment.index, point);
              }
            }}
            onDoubleClick={(e) => {
              if (!draginStartAt && onDoubleClick && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onDoubleClick(e, item, segment.index, point);
              }
            }}
            onMouseOver={(e) => {
              if (!draginStartAt && onMouseOver && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onMouseOver(e, item, segment.index, point);
              }
            }}
            onMouseMove={(e) => {
              if (!draginStartAt && onMouseMove && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onMouseMove(e, item, segment.index, point);
              }
            }}
            onMouseEnter={(e) => {
              if (!draginStartAt && onMouseEnter && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onMouseEnter(e, item, segment.index, point);
              }
            }}
            onMouseLeave={(e) => {
              if (onMouseLeave && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onMouseLeave(e, item, segment.index, point);
              }
            }}
            onMouseDown={(e) => {
              setDraginStartAt(e.clientX);
            }}
            onWheel={(e) => {
              if (!draginStartAt && onWheel && data[segment.index]) {
                const item = data[segment.index];
                const point = getPositionFromMouseEvent(e, item);
                onWheel(e, item, segment.index, point);
              }
            }}
          >
            {/* Create an inner div for the Y axis */}
            {field &&
              data[segment.index] !== undefined &&
              data[segment.index][field] !== undefined && (
                <div
                  className="value"
                  style={computeStyleForDataValue(data[segment.index][field], min, max)}
                />
              )}
            {!field && !isNilObject(data[segment.index], ['begin', 'end', 'index']) && (
              <div className="value" style={{ height: '100%' }} />
            )}

            {/* Create a div for the resize */}
            {segment.index < data.length - 1 && segment.end === data[segment.index].end && (
              <div
                title="Resize"
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
              />
            )}
          </div>
        ))}
      </div>

      {/* Display the X axis */}
      <Scale
        className="scale-x"
        begin={head(data4viz)?.begin || 0}
        end={last(data4viz)?.end || 0}
        min={head(data)?.begin || 0}
        max={last(data)?.end || 0}
      />
    </div>
  );
};
