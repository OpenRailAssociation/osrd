import React, { useState, useEffect, useRef } from 'react';
import { head, last, maxBy, minBy } from 'lodash';
import cx from 'classnames';

import { preventDefault, computeStyleForDataValue, getPositionFromMouseEvent } from './utils';
import {
  cropForDatavizViewbox,
  cropOperationPointsForDatavizViewbox,
  getClosestOperationalPoint,
  getHoveredItem,
} from './data';
import { ResizingScale, SimpleScale } from './Scales';
import IntervalItem from './IntervalItem';
import { IntervalItemBaseProps, LinearMetadataItem, OperationalPoint } from './types';
import './style.scss';

export interface LinearMetadataDatavizProps<T> extends IntervalItemBaseProps<T> {
  /**
   * List of special points to display on the chart
   */
  operationalPoints?: OperationalPoint[];

  /**
   * Part of the data which is visible
   */
  viewBox: [number, number] | null;

  /**
   * Event when the user is dragging
   */
  onDragX?: (gap: number, finalized: boolean) => void;

  /**
   * Event when mouse leaves data item
   */
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;

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
   * Event when the user is resizing an item
   */
  onResize?: (index: number, gap: number, finalized: boolean) => void;
}

/**
 * Component that displays a linear metadata of a line.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LinearMetadataDataviz = <T extends { [key: string]: any }>({
  creating = false,
  data = [],
  emptyValue = undefined,
  field = 'value',
  highlighted = [],
  intervalType,
  operationalPoints = [],
  options = { resizingScale: false, fullHeightItem: false, showValues: false },
  viewBox,
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
}: LinearMetadataDatavizProps<T>) => {
  // Html ref of the div wrapper
  const wrapper = useRef<HTMLDivElement | null>(null);
  // Need to compute the full length of the segment, to compute size in %
  const [fullLength, setFullLength] = useState<number>(0);
  // If the user is doing a drag'n'drop
  const [draginStartAt, setDraginStartAt] = useState<number | null>(null);
  // Store the data for the resizing:
  const [resizing, setResizing] = useState<{
    index: number | null;
    startAt: number; // in px (on the screen)
    startPosition: number; // in m
  } | null>(null);
  // min & max of the data value
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(0);
  // Computed data for the viz and the viewbox
  const [data4viz, setData4viz] = useState<Array<LinearMetadataItem & { index: number }>>([]);
  const [operationalPoints4viz, setOperationalPoints4viz] = useState<
    Array<OperationalPoint & { positionInPx: number }>
  >([]);
  const [hoverAtx, setHoverAtx] = useState<number | null>(null);

  /**
   * When data change (or the field)
   * => we recompute the min/max
   */
  useEffect(() => {
    if (field) {
      if (options.fullHeightItem) {
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
   * When data change
   * => we recompute the data for the viz
   * => we recompute the full length of the displayed data.
   * => we recompute the operationalPoints4viz
   */
  useEffect(() => {
    const nData = cropForDatavizViewbox(data, viewBox);
    const nFullLength = (last(nData)?.end || 0) - (head(nData)?.begin || 0);
    const nOperationalPoints = cropOperationPointsForDatavizViewbox(
      operationalPoints,
      viewBox,
      wrapper,
      nFullLength
    );
    setData4viz(nData);
    setFullLength(nFullLength);
    setOperationalPoints4viz(nOperationalPoints);
  }, [data, viewBox]);

  /**
   * When operationalPoints change
   * => we recompute the operationalPoints4viz
   */
  useEffect(() => {
    if (fullLength > 0) {
      const nOperationalPoints = cropOperationPointsForDatavizViewbox(
        operationalPoints,
        viewBox,
        wrapper,
        fullLength
      );
      setOperationalPoints4viz(nOperationalPoints);
    }
  }, [operationalPoints, fullLength]);

  /**
   * When the window is resized horizontally
   * => we recompute the operationalPoints4viz
   */
  useEffect(() => {
    const debounceResize = () => {
      let debounceTimeoutId;
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = setTimeout(() => {
        const nOperationalPoints = cropOperationPointsForDatavizViewbox(
          operationalPoints,
          viewBox,
          wrapper,
          fullLength
        );
        setOperationalPoints4viz(nOperationalPoints);
      }, 15);
    };
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('resize', debounceResize);
    };
  }, [operationalPoints, viewBox, wrapper, fullLength]);

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
      const leftPadding = wrapper.current.getBoundingClientRect().x;

      // function to compute delta (check for snapping to an operational point)
      const computeDelta = (positionX: number) => {
        const closestPoint = getClosestOperationalPoint(
          positionX - leftPadding,
          operationalPoints4viz
        );
        return closestPoint
          ? closestPoint.position - resizing.startPosition
          : Math.round(((positionX - resizing.startAt) / wrapperWidth) * fullLength);
      };

      // function for key up
      fnUp = (e) => {
        const delta = computeDelta(e.clientX);
        setResizing(null);
        if (resizing.index !== null) onResize(resizing.index, delta, true);
      };

      // function for move
      fnMove = (e) => {
        const delta = computeDelta(e.clientX);
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
        className={cx(
          'data',
          viewBox !== null && draginStartAt && 'dragging',
          resizing && 'resizing',
          (viewBox === null || viewBox[0] === 0) && 'start-visible',
          (viewBox === null || viewBox[1] === last(data)?.end) && 'end-visible'
        )}
        style={{ height: '30px' }}
      >
        {/* Display the operational points */}
        {operationalPoints4viz.map((operationalPoint, index) => (
          <div
            key={`op-${operationalPoint.id || index}`}
            className="operational-point"
            style={{
              position: 'absolute',
              height: '50px',
              left: `${operationalPoint.positionInPx}px`,
              borderLeft: '2px dashed #a0a0a0',
            }}
          >
            {operationalPoint.name && <p>{operationalPoint.name}</p>}
          </div>
        ))}
      </div>
      <div
        id="linear-metadata-dataviz-content"
        ref={wrapper}
        role="presentation"
        onMouseLeave={(e) => {
          setHoverAtx(null);
          if (onMouseLeave) onMouseLeave(e);
        }}
        onMouseMove={(e) => {
          const wrapperObject = wrapper.current;
          // display vertical bar when hover element
          setHoverAtx(e.clientX - (wrapperObject ? wrapperObject.getBoundingClientRect().x : 0));

          if (!draginStartAt && onMouseMove && wrapperObject) {
            const point = getPositionFromMouseEvent(e, fullLength, wrapperObject);
            const result = getHoveredItem(data, e.clientX);
            if (result) {
              const { hoveredItem, hoveredItemIndex } = result;
              onMouseMove(e, hoveredItem, hoveredItemIndex, point);
            }
          }
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
        {field && min !== max && !options.fullHeightItem && (
          <SimpleScale className="scale-y" begin={min} end={max} />
        )}

        {hoverAtx && !draginStartAt && (
          <div
            className="hover-x"
            style={{
              borderLeft: '2px dotted',
              height: '100%',
              left: `${hoverAtx}px`,
              pointerEvents: 'none',
              position: 'absolute',
              zIndex: 3,
            }}
          />
        )}

        {/* Display the operational points */}
        {operationalPoints4viz.map((operationalPoint) => (
          <div
            key={`op-${operationalPoint.id}`}
            className="operational-point"
            style={{
              position: 'absolute',
              height: '100%',
              left: `${operationalPoint.positionInPx}px`,
              borderLeft: '2px dashed #a0a0a0',
            }}
          />
        ))}

        {/* Create one div per item for the X axis */}
        {data4viz.map((segment) => (
          <IntervalItem
            creating={creating}
            data={data}
            dragingStartAt={draginStartAt}
            emptyValue={emptyValue}
            field={field}
            fullLength={fullLength}
            highlighted={highlighted}
            intervalType={intervalType}
            key={`${segment.index}-${segment.begin}-${segment.end}-${fullLength}`}
            min={min}
            max={max}
            onClick={onClick}
            onCreate={onCreate}
            onDoubleClick={onDoubleClick}
            onMouseOver={onMouseOver}
            onMouseEnter={onMouseEnter}
            onWheel={onWheel}
            options={options}
            resizing={resizing}
            segment={segment}
            setDraginStartAt={setDraginStartAt}
            setResizing={setResizing}
          />
        ))}
      </div>

      {/* Display the X axis */}
      {options.resizingScale && wrapper.current ? (
        <ResizingScale
          begin={head(data4viz)?.begin || 0}
          end={last(data4viz)?.end || 0}
          wrapper={wrapper.current}
        />
      ) : (
        <SimpleScale
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
