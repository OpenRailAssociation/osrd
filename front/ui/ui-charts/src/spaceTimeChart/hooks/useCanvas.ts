import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isEqual } from 'lodash';

import { useDevicePixelRatio } from './useDevicePixelRatio';
import { useSize } from './useSize';
import { CanvasContext } from '../lib/context';
import {
  type CanvasContextType,
  type DrawingFunction,
  type DrawingFunctionHandler,
  type HoveredItem,
  LAYERS,
  type LayerType,
  PICKING_LAYERS,
  type PickingDrawingFunction,
  type PickingLayerType,
  type Point,
  type SpaceTimeChartContextType,
} from '../lib/types';
import { getPickingScalingRatio } from '../utils/canvas';
import { colorToIndex, rgbToHex } from '../utils/colors';
import getPNGBlob from '../utils/png';

const PICKING = 'picking';
const RENDERING = 'rendering';

/**
 * This hook handles the internal canvas drawing logic of the SpaceTimeChart component.
 * It is an internal hook, and should only be used inside SpaceTimeChart.
 */
export function useCanvas(
  dom: HTMLElement | null,
  inputStcContext: SpaceTimeChartContextType,
  position?: Point
) {
  // Most things are handled through refs here so that we have a very precise control on when to
  // render anything:
  const canvasesRef = useRef<Record<string, HTMLCanvasElement>>({});
  const contextsRef = useRef<Record<string, CanvasRenderingContext2D>>({});
  const pickingFunctions = useRef<Record<string, Set<PickingDrawingFunction>>>(
    PICKING_LAYERS.reduce((iter, layer) => ({ ...iter, [layer]: new Set() }), {})
  );
  const drawingFunctions = useRef<Record<string, Set<DrawingFunction>>>(
    LAYERS.reduce((iter, layer) => ({ ...iter, [layer]: new Set() }), {})
  );
  const stcContextRef = useRef(inputStcContext);
  const scheduledRef = useRef<null | { frameId: number }>(null);

  const [hoveredItem, setHoveredItem] = useState<HoveredItem | null>(null);

  const size = useSize(dom);
  const sizeRef = useRef<typeof size>(size);

  /**
   * Keep the sizeRef value up to date (to allow rendering functions not being reset anytime size is
   * updated):
   */
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const devicePixelRatio = useDevicePixelRatio();

  /**
   * This function renders all picking layers:
   */
  const drawPicking = useCallback(
    (stcContext: SpaceTimeChartContextType, layers?: Set<LayerType>) => {
      stcContext.resetPickingElements();
      PICKING_LAYERS.forEach((layer) => {
        if (layers && !layers.has(layer)) return;

        const ctx = contextsRef.current[`${PICKING}-${layer}`];
        const set = pickingFunctions.current[layer];

        if (ctx && ctx.canvas.width && ctx.canvas.height) {
          const { width, height } = sizeRef.current;
          ctx.clearRect(0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
          const pickingScalingRatio = getPickingScalingRatio();
          set.forEach((fn) => fn(imageData, stcContext, pickingScalingRatio));
          ctx.putImageData(imageData, 0, 0);
        }
      });
    },
    []
  );

  /**
   * This function renders all visible / rendering layers:
   */
  const drawRendering = useCallback(
    (stcContext: SpaceTimeChartContextType, layers?: Set<LayerType>) => {
      LAYERS.forEach((layer) => {
        if (layers && !layers.has(layer)) return;

        const ctx = contextsRef.current[`${RENDERING}-${layer}`];
        const set = drawingFunctions.current[layer];

        if (ctx) {
          const { width, height } = sizeRef.current;
          ctx.clearRect(0, 0, width, height);
          set.forEach((fn) => fn(ctx, stcContext));
        }
      });
    },
    []
  );

  /**
   * This function draws everything that needs to be drawn, and clears the scheduleRef state:
   */
  const draw = useCallback(() => {
    drawRendering(stcContextRef.current);
    drawPicking(stcContextRef.current);

    if (scheduledRef.current) {
      window.cancelAnimationFrame(scheduledRef.current.frameId);
      scheduledRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * This function schedules a full render for next frame, if no scheduling has been done yet:
   */
  const scheduleRendering = useCallback(() => {
    if (!scheduledRef.current) {
      scheduledRef.current = {
        frameId: window.requestAnimationFrame(draw),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * This function helpers registering a drawing function on a given layer:
   */
  const register = useCallback<DrawingFunctionHandler>(({ type, layer, fn }) => {
    if (type === 'picking') {
      const set = pickingFunctions.current[layer];
      if (set.has(fn)) throw new Error('This picking function has already been registered.');

      set.add(fn);
    } else if (type === 'rendering') {
      const set = drawingFunctions.current[layer];
      if (set.has(fn)) throw new Error('This drawing function has already been registered.');

      set.add(fn);
    }

    scheduleRendering();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * This function helpers unregistering a drawing function from a given layer:
   */
  const unregister = useCallback<DrawingFunctionHandler>(({ type, layer, fn }) => {
    if (type === 'picking') {
      const set = pickingFunctions.current[layer];
      if (!set.has(fn)) throw new Error('This picking function has not been registered.');

      set.delete(fn);
    } else if (type === 'rendering') {
      const set = drawingFunctions.current[layer];
      if (!set.has(fn)) throw new Error('This drawing function has not been registered.');

      set.delete(fn);
    }

    scheduleRendering();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureCanvases = useCallback(
    () =>
      getPNGBlob(
        canvasesRef.current,
        LAYERS.map((layer) => `${RENDERING}-${layer}`),
        stcContextRef.current.theme.background
      ),
    []
  );

  // Create all canvas layers:
  useEffect(() => {
    if (!dom) return;

    const canvases = canvasesRef.current;
    const contexts = contextsRef.current;

    // Create missing layers:
    const allLayers = [
      ...LAYERS.map((layer) => ({ layer, type: 'rendering' })),
      ...PICKING_LAYERS.map((layer) => ({ layer, type: 'picking' })),
    ];
    allLayers.forEach(({ layer, type }) => {
      const layerId = `${type}-${layer}`;
      if (!canvases[layerId]) {
        const canvas = document.createElement('CANVAS') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        canvas.classList.add(`layer-${type}-${layer}`);
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        dom.appendChild(canvas);
        canvases[layerId] = canvas;
        contexts[layerId] = ctx;

        // Draw layer if functions are already registered:
        if (type === 'picking') {
          // (also hide picking layers)
          canvas.style.display = 'none';
        }
      }
    });
  }, [dom]);

  // Redraw all layers when fingerprint changes:
  useEffect(() => {
    // Cache latest context in ref:
    stcContextRef.current = inputStcContext;

    scheduleRendering();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputStcContext.fingerprint]);

  // Handle resizing:
  useEffect(() => {
    const pickingScalingRatio = getPickingScalingRatio();

    for (const id in canvasesRef.current) {
      const canvas = canvasesRef.current[id];
      const ctx = contextsRef.current[id];
      const isPicking = id.split('-')[0] === PICKING;

      if (canvas) {
        const ratio = isPicking ? pickingScalingRatio : devicePixelRatio;

        canvas.style.width = size.width + 'px';
        canvas.style.height = size.height + 'px';
        canvas.setAttribute('width', Math.max(1, size.width * ratio) + 'px');
        canvas.setAttribute('height', Math.max(1, size.height * ratio) + 'px');
        if (isPicking) canvas.style.imageRendering = 'pixelated';

        if (!isPicking) {
          // Reset the transform to identity, then apply the new scale
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(devicePixelRatio, devicePixelRatio);
        }
      }
    }

    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, devicePixelRatio]);

  // Read picking layer on position change:
  useEffect(() => {
    let newHoveredItem: HoveredItem | null = null;
    const pickingScalingRatio = getPickingScalingRatio();

    PICKING_LAYERS.some((layer) => {
      const ctx = contextsRef.current[`${PICKING}-${layer}`];
      if (ctx && position) {
        const [r, g, b, a] = ctx.getImageData(
          Math.round(position.x * pickingScalingRatio),
          Math.round(position.y * pickingScalingRatio),
          1,
          1
        ).data;
        if (a === 255) {
          const color = rgbToHex(r, g, b);
          const index = colorToIndex(color);
          const element = stcContextRef.current.pickingElements[index];
          newHoveredItem = {
            layer,
            element,
          };
          return true;
        }
      }

      return false;
    });

    if (!isEqual(newHoveredItem, hoveredItem)) {
      setHoveredItem(newHoveredItem);
    }
  }, [position, hoveredItem]);

  // Keep the canvas context up to date:
  const canvasContext = useMemo<CanvasContextType>(
    () => ({ register, unregister, captureCanvases }),
    [register, unregister, captureCanvases]
  );

  return {
    canvasContext,
    hoveredItem,
  };
}

/**
 * This hook helps to bind a picking function to a layer in the SpaceTimeChart.
 * It is public and can be used outside SpaceTimeChart.
 */
export function usePicking(layer: PickingLayerType, fn: PickingDrawingFunction) {
  const { register, unregister } = useContext(CanvasContext);

  useEffect(() => {
    register({ type: 'picking', layer, fn });

    return () => {
      unregister({ type: 'picking', layer, fn });
    };
  }, [layer, fn, register, unregister]);
}

/**
 * This hook helps to bind a drawing function to a layer in the SpaceTimeChart.
 * It is public and can be used outside SpaceTimeChart.
 */
export function useDraw(layer: LayerType, fn: DrawingFunction) {
  const { register, unregister } = useContext(CanvasContext);

  useEffect(() => {
    register({ type: 'rendering', layer, fn });

    return () => {
      unregister({ type: 'rendering', layer, fn });
    };
  }, [layer, fn, register, unregister]);
}
