import { useEffect, useState } from 'react';

/**
 * This hook takes a DOM element reference as input, and returns always updated width and height.
 * It is an internal hook, and should only be used inside SpaceTimeChart.
 */
export function useSize(dom?: HTMLElement | null) {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: dom?.offsetWidth || 1,
    height: dom?.offsetHeight || 1,
  });

  useEffect(() => {
    // Function to update the state with the new size
    const updateSize = () => {
      const width = dom?.offsetWidth || 1;
      const height = dom?.offsetHeight || 1;

      if (width !== size.width || height !== size.height) setSize({ width, height });
    };

    if (!dom) {
      updateSize();
      return;
    } else {
      const observer = new ResizeObserver(updateSize);
      observer.observe(dom);

      return () => {
        observer.disconnect();
      };
    }
  }, [dom, size.height, size.width]);

  return size;
}
