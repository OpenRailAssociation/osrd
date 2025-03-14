import * as d3selection from 'd3-selection';

import { zoom } from './layersManager';
import type { DrawFunctionParams } from '../../types';
import { FRONT_INTERACTIVITY_LAYER_ID } from '../const';
import { clearCanvas } from '../utils';

export const drawFrame = ({ ctx, width, height, store, setStore }: DrawFunctionParams) => {
  clearCanvas(ctx, width, height);

  const canvas = d3selection.select(FRONT_INTERACTIVITY_LAYER_ID) as d3selection.Selection<
    Element,
    unknown,
    HTMLCanvasElement,
    unknown
  >;

  // zoom interaction
  if (setStore) canvas.call(zoom(setStore));

  // cursor interaction
  canvas.on('mousemove', (event) => {
    const cursor = d3selection.pointer(event);

    if (setStore) {
      setStore(() => ({
        ...store,
        cursor: {
          x: cursor[0],
          y: cursor[1],
        },
      }));
    }
  });

  canvas.on('mouseleave', () => {
    if (setStore) {
      setStore(() => ({
        ...store,
        cursor: {
          x: null,
          y: null,
        },
      }));
    }
  });
};
