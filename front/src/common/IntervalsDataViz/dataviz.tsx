import React, { useState, useEffect, useRef } from 'react';
import { head, last, maxBy, minBy } from 'lodash';
import cx from 'classnames';

import { preventDefault, computeStyleForDataValue } from './utils';
import { LinearMetadataItem, cropForDatavizViewbox } from './data';
import { ResizingScale, SimpleScale } from './Scales';
import IntervalItem from './IntervalItem';
import { IntervalItemBaseProps } from './types';
import './style.scss';

export interface LinearMetadataDatavizProps<T> extends IntervalItemBaseProps<T> {
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
  intervalType,
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
  options = { resizingScale: false, fullHeightItem: false, showValues: false },
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
        const delta = Math.round(((e.clientX - resizing.startAt) / wrapperWidth) * fullLength);
        setResizing(null);
        if (resizing.index !== null) onResize(resizing.index, delta, true);
      };
      // function for move
      fnMove = (e) => {
        const delta = Math.round(((e.clientX - resizing.startAt) / wrapperWidth) * fullLength);
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
        id="linear-metadata-dataviz-content"
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
        {field && min !== max && !options.fullHeightItem && (
          <SimpleScale className="scale-y" begin={min} end={max} />
        )}

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
            onMouseMove={onMouseMove}
            onMouseOver={onMouseOver}
            onMouseEnter={onMouseEnter}
            onWheel={onWheel}
            options={options}
            resizing={resizing}
            segment={segment}
            setDraginStartAt={setDraginStartAt}
            setHoverAtx={setHoverAtx}
            setResizing={setResizing}
            wrapper={wrapper}
          />
        ))}
      </div>

      {/* Display the X axis */}
      {options.resizingScale ? (
        <ResizingScale
          begin={head(data4viz)?.begin || 0}
          end={last(data4viz)?.end || 0}
          className="scale-x"
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
