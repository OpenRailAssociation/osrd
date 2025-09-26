import React, { useLayoutEffect, useRef, useState } from 'react';

type OSRDTooltipProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  header: string;
  items: string[];
  offsetRatio?: {
    top?: number;
    left?: number;
  };
  reverseIfOverflow?: boolean;
};

const TOOLTIP_BOTTOM_MARGIN = 24;

const OSRDTooltip = ({
  containerRef,
  header,
  items,
  offsetRatio,
  reverseIfOverflow,
}: OSRDTooltipProps) => {
  const tooltipContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{
    top?: number;
    left: number;
    bottom?: number;
  } | null>(null);

  const offsetTopRatio = offsetRatio?.top ?? 1;
  const offsetLeftRatio = offsetRatio?.left ?? 1;

  useLayoutEffect(() => {
    if (!tooltipContainerRef.current || !containerRef.current) return;

    tooltipContainerRef.current.showPopover();

    const rect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();

    const wouldOverflowBottom =
      tooltipRect &&
      rect.height * offsetTopRatio + rect.bottom + tooltipRect?.height + TOOLTIP_BOTTOM_MARGIN >
        window.innerHeight;

    // Check if menu would overflow on the right side of the viewport
    const wouldOverflowRight = tooltipRect && rect.left + tooltipRect.width > window.innerWidth;

    const tooltipLeftPosition = wouldOverflowRight
      ? rect.right + window.scrollX - tooltipRect.width
      : rect.left + window.scrollX + rect.width * offsetLeftRatio;

    if (wouldOverflowBottom && reverseIfOverflow) {
      setPosition({
        left: tooltipLeftPosition,
        top: rect.top + window.scrollY - (tooltipRect?.height || 0) - TOOLTIP_BOTTOM_MARGIN,
        bottom: undefined,
      });
      return;
    }

    if (wouldOverflowBottom) {
      setPosition({
        left: tooltipLeftPosition,
        top: undefined,
        bottom: TOOLTIP_BOTTOM_MARGIN,
      });
      return;
    }

    // no overflow
    setPosition({
      top: rect.top + window.scrollY + rect.height * offsetTopRatio,
      left: tooltipLeftPosition,
      bottom: undefined,
    });
  }, []);

  return (
    <div
      data-testid="osrd-tooltip"
      className="osrd-tooltip"
      style={{
        top: position?.top ? position.top - window.scrollY : undefined,
        left: position?.left ? position.left - window.scrollX : undefined,
        bottom: position?.bottom ? position.bottom - window.scrollY : undefined,
      }}
      popover="hint"
      ref={tooltipContainerRef}
    >
      <div ref={tooltipRef}>
        <span className="osrd-tooltip-header">{header}</span>
        <hr />
        <div className="osrd-tooltip-body">
          {items.map((item, i) => (
            <span key={i} data-testid="tooltip-item" className="tooltip-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OSRDTooltip;
