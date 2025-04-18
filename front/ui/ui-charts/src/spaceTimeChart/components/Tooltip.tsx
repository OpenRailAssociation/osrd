import React from 'react';

import type { Point } from '../lib/types';

export type TooltipProps = {
  position: Point;
  children: React.ReactNode;
};

export const Tooltip = ({ position, children }: TooltipProps) => (
  <div className="ui-spacetimechart-tooltip" style={{ left: position.x, top: position.y }}>
    {children}
  </div>
);
