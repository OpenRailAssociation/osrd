import React, { useState, useEffect, useRef } from 'react';
import { LineString } from 'geojson';
import { head, last } from 'lodash';
import cx from 'classnames';

import { tooltipPosition, roundNumber } from './utils';
import { LinearMetadataItem } from './data';
import { LinearMetadataTooltip } from './tooltip';
import './style.scss';

function stopPropagation(e: Event) {
  e.preventDefault();
}

export interface LinearMetadataDatavizProps<T> {
  /**
   * List of data to display (must be ordered by begin/end)
   */
  data: Array<LinearMetadataItem<T>>;
  /**
   * List of elements (by begin value) that should be highlighted
   */
  highlighted: Array<number>;
  /**
   * Wich part of the data are visible ?
   */
  viewBox: [number, number] | null;
  /**
   * Events
   */
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;
  onMouseOver?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;
  onMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;
  onMouseLeave?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;
  onWheel?: (
    e: React.WheelEvent<HTMLDivElement>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;
}

/**
 * Component that display a linear metadata of a line,
 * and allow the user to edit it.
 */
export const LinearMetadataDataviz = <T extends any>({
  data,
  viewBox,
  highlighted = [],
  onClick,
  onMouseMove,
  onMouseOver,
  onMouseEnter,
  onMouseLeave,
  onWheel,
}: LinearMetadataDatavizProps<T>) => {
  // Html ref of the div wrapper
  const wrapper = useRef<HTMLDivElement | null>(null);
  // Need to compute the full length of the segment, to compute size in %
  const [fullLength, setFullLength] = useState<number>(0);
  // Computed data for the viz and the viewbox
  const [data4viz, setData4viz] = useState<Array<LinearMetadataItem & { index: number }>>([]);

  /**
   * When the wrapper div change
   * => we add on en event on it to catch the wheel event and prevent the scroll
   * NOTE: the prevent default directly on the event doesn't work, that's why we need
   * to register it on the ref (@see https://github.com/facebook/react/issues/5845)
   */
  useEffect(() => {
    if (wrapper.current) {
      wrapper.current.addEventListener('wheel', stopPropagation);
    }
    return () => {
      if (wrapper.current) wrapper.current.removeEventListener('wheel', stopPropagation);
    };
  }, [wrapper]);

  /**
   * When data or viewbox change
   * => we recompute the data for the viz
   */
  useEffect(() => {
    setData4viz(
      data
        // we add the index so events are able to send the index
        .map((segment, index) => Object.assign(segment, { index }))
        // we filter elements that croos or are inside the viewbox
        .filter((e) => {
          if (!viewBox) return true;
          // if one extrimity is in (ie. overlaps or full in)
          if (viewBox[0] <= e.begin && e.begin <= viewBox[1]) return true;
          if (viewBox[0] <= e.end && e.end <= viewBox[1]) return true;
          // if include the viewbox
          if (e.begin <= viewBox[0] && viewBox[1] <= e.end) return true;
          // else
          return false;
        })
        // we crop the extremities if needed
        .map((e) => {
          if (!viewBox) return e;
          return {
            index: e.index,
            begin: e.begin < viewBox[0] ? viewBox[0] : e.begin,
            end: e.end > viewBox[1] ? viewBox[1] : e.end,
          };
        })
    );
  }, [data, viewBox]);

  /**
   * When data4viz changed :
   * => we recompute the full length of the line.
   */
  useEffect(() => {
    setFullLength((last(data4viz)?.end || 0) - (head(data4viz)?.begin || 0));
  }, [data4viz]);

  return (
    <div ref={wrapper} className={cx('linear-metadata-visualisation')}>
      <div className={cx('data', highlighted.length > 0 && 'has-highlight')}>
        {data4viz.map((segment) => (
          <div
            key={`${segment.begin}-${segment.end}`}
            className={cx(highlighted.includes(segment.index) && 'highlighted')}
            style={{
              width: `${((segment.end - segment.begin) / fullLength) * 100}%`,
            }}
            onClick={(e) => {
              if (onClick) onClick(e, data[segment.index], segment.index);
            }}
            onMouseOver={(e) => {
              if (onMouseOver) onMouseOver(e, data[segment.index], segment.index);
            }}
            onMouseMove={(e) => {
              if (onMouseMove) onMouseMove(e);
            }}
            onMouseEnter={(e) => {
              if (onMouseEnter) onMouseEnter(e, data[segment.index], segment.index);
            }}
            onMouseLeave={(e) => {
              if (onMouseLeave) onMouseLeave(e, data[segment.index], segment.index);
            }}
            onWheel={(e) => {
              console.log(e);
              if (onWheel) {
                const item = data[segment.index];
                const pxOffset = e.nativeEvent.offsetX;
                const pxSize = (e.target as HTMLDivElement).offsetWidth;
                const point = item.begin + (pxOffset / pxSize) * (item.end - item.begin);
                onWheel(e, data[segment.index], segment.index, point);
              }
            }}
          />
        ))}
      </div>
      <Scale begin={head(data4viz)?.begin || 0} end={last(data4viz)?.end || 0} />
    </div>
  );
};

const Scale: React.FC<{ begin: number; end: number }> = ({ begin, end }) => {
  const [inf, setInf] = useState<number>(0);
  const [sup, setSup] = useState<number>(0);

  useEffect(() => {
    setInf(roundNumber(begin, true));
    setSup(roundNumber(end, false));
  }, [begin, end]);

  return (
    <div className="scale">
      <span>{inf}</span>
      <span>{sup}</span>
    </div>
  );
};
