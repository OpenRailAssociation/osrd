import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { head, last, maxBy, minBy } from 'lodash';
import cx from 'classnames';

import { roundNumber, preventDefault, isNilObject, shortNumber } from './utils';
import { LinearMetadataItem, cropForDatavizViewbox } from './data';
import './style.scss';

/**
 * Function that compute the div style attribut for a data value.
 */
function computeStyleForDataValue(
  value: number,
  min: number,
  max: number,
  stringValues?: boolean
): CSSProperties {
  if (stringValues)
    return {
      height: `100%`,
      opacity: 0.8,
      zIndex: 2,
    };
  if (min < 0) {
    const negativeAreaHeightRatio = Math.abs(min / (max - min));
    const dataHeight = Math.abs(value / (max - min));
    return {
      height: `${dataHeight * 100}%`,
      bottom: `${
        (value >= 0 ? negativeAreaHeightRatio : negativeAreaHeightRatio - dataHeight) * 100
      }%`,
      position: 'relative',
      opacity: 0.8,
      zIndex: 2,
    };
  }
  return {
    height: `${((value - min) / (max - min)) * 100}%`,
    opacity: 0.8,
    zIndex: 2,
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

const ScaleTicked: React.FC<{
  className?: string;
  begin: number;
  end: number;
  steps: number;
}> = ({ className, begin, end, steps }) => {
  const [inf, setInf] = useState<number>(0);
  const [sup, setSup] = useState<number>(0);
  const [inc, setInc] = useState<number>(0);

  useEffect(() => {
    setInf(roundNumber(begin, true));
    setSup(roundNumber(end, false));
    setInc(roundNumber((end - begin) / steps / 2, true));
  }, [begin, end, steps]);

  return (
    <div className={`scale ${className}`}>
      <div className="axis-values">
        {[...Array(steps)].map((_, i) => (
          <div key={i}>
            {i === 0 && <span className="bottom-axis-value">{shortNumber(inf)}</span>}
            <span>{shortNumber(((sup - inf) / steps) * i + inc + inf)}</span>
            {i === steps - 1 && <span className="top-axis-value">{shortNumber(sup)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

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
   * Boolean indicating if we are going to create a new item
   */
  creating?: boolean;

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
   * Part of the data which is visible
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
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;

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

  /**
   * Event when the user is creating an item
   */
  onCreate?: (point: number) => void;

  /**
   * Params on dataviz behavior
   * ticks: should scale be ticked ?
   * stringValues: each interval has just a category ref, not a continuous value
   */
  params?: { ticks?: boolean; stringValues?: boolean; showValues?: boolean };
}

/**
 * Component that display a linear metadata of a line.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LinearMetadataDataviz = <T extends { [key: string]: any }>({
  creating = false,
  data = [],
  field = 'value',
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
  onCreate,
  params,
}: LinearMetadataDatavizProps<T>) => {
  // Html ref of the div wrapper
  const wrapper = useRef<HTMLDivElement | null>(null);
  // Need to compute the full length of the segment, to compute size in %
  const [fullLength, setFullLength] = useState<number>(0);
  // If the user is doing a drag'n'drop
  const [draginStartAt, setDraginStartAt] = useState<number | null>(null);
  // Store the data for the resizing:
  const [resizing, setResizing] = useState<{ index: number | null; startAt: number } | null>(null);
  // min & max of the data value
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(0);
  // Computed data for the viz and the viewbox
  const [data4viz, setData4viz] = useState<Array<LinearMetadataItem & { index: number }>>([]);
  const [hoverAtx, setHoverAtx] = useState<number | null>(null);

  /**
   * When data change (or the field)
   * => we recompute the min/max
   */
  useEffect(() => {
    if (field) {
      if (params?.stringValues) {
        // we just need an arbitrary space for scaleY in that case
        setMin(0);
        setMax(1);
      }
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
        if (resizing.index !== null) onResize(resizing.index, delta, true);
      };
      // function for move
      fnMove = (e) => {
        const delta = ((e.clientX - resizing.startAt) / wrapperWidth) * fullLength;
        if (resizing.index !== null) onResize(resizing.index, delta, false);
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
        role="presentation"
        onMouseLeave={(e) => {
          setHoverAtx(null);
          if (onMouseLeave) onMouseLeave(e);
        }}
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
        {field &&
          min !== max &&
          !params?.stringValues &&
          (params?.ticks ? (
            <ScaleTicked className="scale-y" steps={4} begin={min} end={max} />
          ) : (
            <Scale className="scale-y" begin={min} end={max} />
          ))}

        {hoverAtx && !draginStartAt && (
          <div
            className="hover-x"
            style={{
              position: 'absolute',
              height: '100%',
              left: `${hoverAtx}px`,
              borderLeft: '2px dotted',
            }}
          />
        )}

        {/* Create one div per item for the X axis */}
        {data4viz.map((segment) => (
          <div
            key={`${segment.index}-${segment.begin}-${segment.end}-${fullLength}`}
            className={cx(
              'item',
              highlighted.includes(segment.index) && 'highlighted',
              field &&
                data[segment.index] !== undefined &&
                data[segment.index][field] !== undefined &&
                'with-data',
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
              if (!draginStartAt) {
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
              setHoverAtx(
                e.clientX - (wrapper.current ? wrapper.current.getBoundingClientRect().x : 0)
              );

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
            {segment.index < data.length - 1 && segment.end === data[segment.index].end && (
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
        ))}
      </div>

      {/* Display the X axis */}
      {params?.ticks ? (
        <ScaleTicked
          className="scale-x"
          begin={head(data4viz)?.begin || 0}
          end={last(data4viz)?.end || 0}
          steps={10}
        />
      ) : (
        <Scale
          className="scale-x"
          begin={head(data4viz)?.begin || 0}
          end={last(data4viz)?.end || 0}
          min={head(data)?.begin || 0}
          max={last(data)?.end || 0}
        />
      )}
    </div>
  );
};
