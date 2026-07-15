import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isEqual } from 'lodash';

import { PICKING_LAYERS, LAYERS } from '../consts';
import { rgbToHex, colorToIndex } from '../helpers/colors';
import getPNGBlob from '../helpers/png';
import { getPickingScalingRatio } from '../helpers/utils';
import type {
  BaseChartContextType,
  CanvasContextType,
  DrawingFunction,
  DrawingFunctionHandler,
  HoveredItem,
  LayerType,
  PickingDrawingFunction,
  PickingLayerType,
  Point,
  PickingElement,
} from '../types';
import { useDevicePixelRatio } from './useDevicePixelRatio';
import { useSize } from './useSize';

const PICKING = 'picking';
const RENDERING = 'rendering';

/**
 * This hook handles the internal canvas drawing logic of a chart component.
 */
export function useCanvas<T extends BaseChartContextType>(
  dom: HTMLElement | null,
  chartContext: T,
  position?: Point
) {
  // Most things are handled through refs here so that we have a very precise control on when to
  // render anything:
  const canvasesRef = useRef<Record<string, HTMLCanvasElement>>({});
  const contextsRef = useRef<Record<string, CanvasRenderingContext2D>>({});
  const pickingFunctions = useRef<Record<string, Set<PickingDrawingFunction<T>>>>(
    PICKING_LAYERS.reduce((iter, layer) => ({ ...iter, [layer]: new Set() }), {})
  );
  const drawingFunctions = useRef<Record<string, Set<DrawingFunction<T>>>>(
    LAYERS.reduce((iter, layer) => ({ ...iter, [layer]: new Set() }), {})
  );
  const chartContextRef = useRef(chartContext);
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

  const pickingState = useMemo(() => {
    const pickingElements: Record<PickingLayerType, PickingElement[]> = {
      paths: [],
      overlay: [],
    };
    const resetPickingElements = (layers?: Set<LayerType>) => {
      for (const layer of PICKING_LAYERS) {
        if (!layers || layers.has(layer)) {
          pickingElements[layer].length = 0;
        }
      }
    };
    const registerPickingElement = (layer: PickingLayerType, element: PickingElement) => {
      pickingElements[layer].push(element);
      return pickingElements[layer].length - 1;
    };
    return {
      pickingElements,
      resetPickingElements,
      registerPickingElement,
    };
  }, []);

  /**
   * This function renders all picking layers:
   */
  const drawPicking = useCallback(
    (context: T, layers?: Set<LayerType>) => {
      pickingState.resetPickingElements(layers);
      PICKING_LAYERS.forEach((layer) => {
        if (layers && !layers.has(layer)) return;

        const ctx = contextsRef.current[`${PICKING}-${layer}`];
        const set = pickingFunctions.current[layer];

        if (ctx && ctx.canvas.width && ctx.canvas.height) {
          const { width, height } = sizeRef.current;
          ctx.clearRect(0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
          const pickingScalingRatio = getPickingScalingRatio();
          const pickingContext = {
            ...context,
            registerPickingElement: (elem: PickingElement) =>
              pickingState.registerPickingElement(layer, elem),
          };
          set.forEach((fn) => fn(imageData, pickingContext, pickingScalingRatio));
          ctx.putImageData(imageData, 0, 0);
        }
      });
    },
    [pickingState]
  );

  /**
   * This function renders all visible / rendering layers:
   */
  const drawRendering = useCallback((context: T, layers?: Set<LayerType>) => {
    LAYERS.forEach((layer) => {
      if (layers && !layers.has(layer)) return;

      const ctx = contextsRef.current[`${RENDERING}-${layer}`];
      const set = drawingFunctions.current[layer];

      if (ctx) {
        const { width, height } = sizeRef.current;
        ctx.clearRect(0, 0, width, height);
        set.forEach((fn) => {
          // Reset alpha before each drawing function to prevent having the faded out-of-selection  from the STD
          ctx.globalAlpha = 1;
          fn(ctx, context);
        });
      }
    });
  }, []);

  /**
   * This function draws everything that needs to be drawn, and clears the scheduleRef state:
   */
  const draw = useCallback(() => {
    drawRendering(chartContextRef.current);
    drawPicking(chartContextRef.current);

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
  const register = useCallback<DrawingFunctionHandler<T>>(({ type, layer, fn }) => {
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
  const unregister = useCallback<DrawingFunctionHandler<T>>(({ type, layer, fn }) => {
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
        chartContextRef.current.theme.background
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
    chartContextRef.current = chartContext;

    scheduleRendering();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartContext.fingerprint]);

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
          const element = pickingState.pickingElements[layer][index];
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
  }, [position, hoveredItem, pickingState]);

  // Keep the canvas context up to date:
  const canvasContext = useMemo<CanvasContextType<T>>(
    () => ({ register, unregister, captureCanvases }),
    [register, unregister, captureCanvases]
  );

  return {
    canvasContext,
    hoveredItem,
  };
}

/**
 * This hook helps to bind a picking function to a layer in a Chart.
 */
export function usePicking<T>(
  contextKey: React.Context<CanvasContextType<T>>,
  layer: PickingLayerType,
  fn: PickingDrawingFunction<T>
) {
  const { register, unregister } = useContext(contextKey);

  useEffect(() => {
    register({ type: 'picking', layer, fn });

    return () => {
      unregister({ type: 'picking', layer, fn });
    };
  }, [layer, fn, register, unregister]);
}

/**
 * This hook helps to bind a drawing function to a layer in a chart.
 */
export function useDraw<T>(
  contextKey: React.Context<CanvasContextType<T>>,
  layer: LayerType,
  fn: DrawingFunction<T>
) {
  const { register, unregister } = useContext(contextKey);

  useEffect(() => {
    register({ type: 'rendering', layer, fn });

    return () => {
      unregister({ type: 'rendering', layer, fn });
    };
  }, [layer, fn, register, unregister]);
}
