import React from 'react';

const TOOLTIP_WIDTH = 246;

type TooltipProps = {
  cursorX: number;
  cursorY: number;
  height: number;
  text: string;
};

const Tooltip = ({ cursorX, cursorY, height, text }: TooltipProps) => (
  <div
    id="tooltip"
    className="absolute"
    style={{
      marginTop: cursorY,
      marginLeft: cursorX - TOOLTIP_WIDTH / 2,
      maxHeight: height,
    }}
  >
    <span>{text}</span>
  </div>
);

export default Tooltip;
