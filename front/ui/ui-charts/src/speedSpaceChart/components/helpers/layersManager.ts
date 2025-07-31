import * as d3selection from 'd3-selection';
import * as d3zoom from 'd3-zoom';

import type { Store } from '../../types';
import { FRONT_INTERACTIVITY_LAYER_ID } from '../const';

export const resetZoom = () =>
  d3zoom.zoom().transform(d3selection.select(FRONT_INTERACTIVITY_LAYER_ID), d3zoom.zoomIdentity);

export const zoom = (setStore: React.Dispatch<React.SetStateAction<Store>>) =>
  d3zoom
    .zoom()
    .filter((event) => event.shiftKey)
    .on('zoom', () => {
      const canvas = d3selection.select(FRONT_INTERACTIVITY_LAYER_ID) as d3selection.Selection<
        Element,
        unknown,
        HTMLCanvasElement,
        unknown
      >;

      const { k: ratioX, x: leftOffset } = d3zoom.zoomTransform(canvas.node() as Element);

      if (ratioX >= 1) {
        setStore((prev) => ({
          ...prev,
          ratioX,
          leftOffset,
        }));
      } else {
        setStore((prev) => ({
          ...prev,
          ratioX: 1,
          leftOffset: 0,
        }));
        canvas.call(resetZoom);
      }
    });

export const computeLeftOffsetOnZoom = (value: number) => {
  const canvas = d3selection.select(FRONT_INTERACTIVITY_LAYER_ID) as d3selection.Selection<
    Element,
    unknown,
    HTMLCanvasElement,
    unknown
  >;
  const transform = d3zoom.zoomIdentity.scale(value);
  d3zoom.zoom().transform(canvas, transform);
  return transform.x;
};
