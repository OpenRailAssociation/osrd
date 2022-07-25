import React, { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { LineString } from 'geojson';
import { head, last, maxBy, minBy } from 'lodash';
import cx from 'classnames';

import { tooltipPosition, roundNumber } from './utils';
import { transalteViewBox, LinearMetadataItem } from './data';
import { LinearMetadataTooltip } from './tooltip';
import { isNilObject } from './utils';
import './style.scss';

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
  } else {
    return {
      height: `${((value - min) / (max - min)) * 100}%`,
    };
  }
}

function stopPropagation(e: Event) {
  e.preventDefault();
}

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
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;

  /**
   * Event on click on a data item
   */
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;

  /**
   * Event when mouse over a data item
   */
  onMouseOver?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;

  /**
   * Event when mouse enter into data item
   */
  onMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
  ) => void;

  /**
   * Event when mouse leave into data item
   */
  onMouseLeave?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number
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
   * Event when the viewbox change (for drag'n'drop)
   */
  onViewBoxChange?: (viewbox: [number, number] | null) => void;
}

/**
 * Component that display a linear metadata of a line,
 * and allow the user to edit it.
 */
export const LinearMetadataDataviz = <T extends any>({
  data,
  field,
  viewBox,
  highlighted = [],
  onClick,
  onMouseMove,
  onMouseOver,
  onMouseEnter,
  onMouseLeave,
  onWheel,
  onViewBoxChange,
}: LinearMetadataDatavizProps<T>) => {
  // Html ref of the div wrapper
  const wrapper = useRef<HTMLDivElement | null>(null);
  // ViewBox: we store it, due to the drag'n'drop feature when mouse is mooving.
  // Otherwise it is managed by the parent component.
  const [currentViewBox, setCurrentViewBox] = useState<[number, number] | null>(viewBox);
  // Need to compute the full length of the segment, to compute size in %
  const [fullLength, setFullLength] = useState<number>(0);
  // If the user is doing a drag'n'drop
  const [draginStartAt, setDraginStartAt] = useState<number | null>(null);
  // min & max of the data value
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(0);
  // Computed data for the viz and the viewbox
  const [data4viz, setData4viz] = useState<Array<LinearMetadataItem & { index: number }>>([]);

  /**
   * Function to compute the new viewbox after a translation
   */
  const fnDragX = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (wrapper.current && draginStartAt) {
        const delta = ((draginStartAt - e.clientX) / wrapper.current.offsetWidth) * fullLength;
        // /!\ the delta is bases on viewbox, not on the currentViewBox
        return transalteViewBox(data, viewBox, delta);
      }
      return viewBox;
    },
    [draginStartAt, wrapper, viewBox, fullLength, data]
  );

  /**
   * When viewbox change
   * => we save it in the state
   */
  useEffect(() => {
    setCurrentViewBox(viewBox);
  }, [viewBox]);

  /**
   * When the wrapper div change
   * => we listen event on it to catch the wheel event and prevent the scroll
   * => we listen for resize to compute its width (used in the drag'n'drop)
   * NOTE: the prevent default directly on the event doesn't work, that's why we need
   * to register it on the ref (@see https://github.com/facebook/react/issues/5845)
   */
  useEffect(() => {
    if (wrapper.current) {
      wrapper.current.addEventListener('wheel', stopPropagation);
    }
    return () => {
      if (wrapper.current) {
        wrapper.current.removeEventListener('wheel', stopPropagation);
      }
    };
  }, [wrapper]);

  /**
   * When data change (or the field)
   * => we recompute the min/max
   */
  useEffect(() => {
    if (field) {
      const min = minBy(data, field);
      const max = maxBy(data, field);
      setMin(min && min[field] < 0 ? min[field] : 0);
      setMax(max && max[field] > 0 ? max[field] : 0);
    } else {
      setMin(0);
      setMax(0);
    }
  }, [data, field]);

  /**
   * When data or currentViewBox change
   * => we recompute the data for the viz
   */
  useEffect(() => {
    setData4viz(
      data
        // we add the index so events are able to send the index
        .map((segment, index) => Object.assign(segment, { index }))
        // we filter elements that croos or are inside the viewbox
        .filter((e) => {
          if (!currentViewBox) return true;
          // if one extrimity is in (ie. overlaps or full in)
          if (currentViewBox[0] <= e.begin && e.begin <= currentViewBox[1]) return true;
          if (currentViewBox[0] <= e.end && e.end <= currentViewBox[1]) return true;
          // if include the viewbox
          if (e.begin <= currentViewBox[0] && currentViewBox[1] <= e.end) return true;
          // else
          return false;
        })
        // we crop the extremities if needed
        .map((e) => {
          if (!currentViewBox) return e;
          return {
            index: e.index,
            begin: e.begin < currentViewBox[0] ? currentViewBox[0] : e.begin,
            end: e.end > currentViewBox[1] ? currentViewBox[1] : e.end,
          };
        })
    );
  }, [data, currentViewBox]);

  /**
   * When data4viz changed :
   * => we recompute the full length of the line.
   */
  useEffect(() => {
    setFullLength((last(data4viz)?.end || 0) - (head(data4viz)?.begin || 0));
  }, [data4viz]);

  /**
   * When start to drag
   * => register event on document for the mouseUp
   */
  useEffect(() => {
    const fnUp = (e) => {
      if (draginStartAt && onViewBoxChange) {
        onViewBoxChange(fnDragX(e));
        setDraginStartAt(null);
        // setTimeout(() => setDraginStartAt(null), 0);
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const fnMove = (e) => {
      if (draginStartAt) {
        setCurrentViewBox(fnDragX(e));
        e.stopPropagation();
        e.preventDefault();
      }
    };
    if (draginStartAt !== null) {
      document.addEventListener('mouseup', fnUp, true);
      document.addEventListener('mousemove', fnMove, true);
    }
    return () => {
      if (draginStartAt !== null) {
        document.removeEventListener('mouseup', fnUp, true);
        document.removeEventListener('mousemove', fnMove, true);
      }
    };
  }, [draginStartAt, fnDragX]);

  return (
    <div className={cx('linear-metadata-visualisation')}>
      {min < 0 && max > 0 && (
        <div
          className="axis-zero"
          style={{
            top: `${100 - ((0 - min) / (max - min)) * 100}%`,
          }}
        />
      )}
      <div
        ref={wrapper}
        className={cx('data', highlighted.length > 0 && 'has-highlight', draginStartAt && 'drag')}
      >
        <>
          {field && min !== max && <Scale className="scale-y" begin={min} end={max} />}
          {data4viz.map((segment) => (
            <div
              key={`${segment.begin}-${segment.end}`}
              className={cx(
                highlighted.includes(segment.index) && 'highlighted',
                field && !data[segment.index][field] && 'no-data',
                !field && isNilObject(data[segment.index], ['begin', 'end', 'index']) && 'no-data'
              )}
              style={{
                width: `${((segment.end - segment.begin) / fullLength) * 100}%`,
              }}
              onClick={(e) => {
                if (!draginStartAt && onClick) {
                  onClick(e, data[segment.index], segment.index);
                }
              }}
              onMouseOver={(e) => {
                if (!draginStartAt && onMouseOver) {
                  onMouseOver(e, data[segment.index], segment.index);
                }
              }}
              onMouseMove={(e) => {
                if (!draginStartAt && onMouseMove) {
                  onMouseMove(e);
                }
              }}
              onMouseEnter={(e) => {
                if (!draginStartAt && onMouseEnter)
                  onMouseEnter(e, data[segment.index], segment.index);
              }}
              onMouseLeave={(e) => {
                if (onMouseLeave) onMouseLeave(e, data[segment.index], segment.index);
              }}
              onMouseDown={(e) => {
                setDraginStartAt(e.clientX);
                // to avoid to display tooltip when dragin
                // if (onMouseLeave) onMouseLeave(e, data[segment.index], segment.index);
              }}
              onWheel={(e) => {
                if (!draginStartAt && onWheel) {
                  const item = data[segment.index];
                  const pxOffset = e.nativeEvent.offsetX;
                  const pxSize = (e.target as HTMLDivElement).offsetWidth;
                  const point = item.begin + (pxOffset / pxSize) * (item.end - item.begin);
                  onWheel(e, data[segment.index], segment.index, point);
                }
              }}
            >
              {field && data[segment.index][field] && (
                <div style={computeStyleForDataValue(data[segment.index][field], min, max)}></div>
              )}
            </div>
          ))}
        </>
      </div>
      <Scale
        className="scale-x"
        begin={head(data4viz)?.begin || 0}
        end={last(data4viz)?.end || 0}
        min={0}
        max={last(data)?.end || 0}
      />
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
        {inf}
      </span>
      <span
        className={cx(
          max !== undefined && max === end && 'font-weight-bold',
          max === undefined && 'font-weight-bold'
        )}
        title={`${sup}`}
      >
        {sup}
      </span>
    </div>
  );
};
