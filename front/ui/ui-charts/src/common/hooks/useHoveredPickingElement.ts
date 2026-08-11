import { useCallback, useState } from 'react';

import type { HoveredItem, PickingElement } from '../types';

// Tracks the picking element currently hovered in a chart, filtered by type.
// The returned handler is meant to be passed as `onHoveredChildUpdate`.
const useHoveredPickingElement = <T extends PickingElement>(
  isElement: (element: PickingElement) => element is T
) => {
  const [hoveredElement, setHoveredElement] = useState<T>();

  const handleHoveredChildUpdate = useCallback(
    ({ item }: { item: HoveredItem | null }) => {
      setHoveredElement(item && isElement(item.element) ? item.element : undefined);
    },
    [isElement]
  );

  return { hoveredElement, handleHoveredChildUpdate };
};

export default useHoveredPickingElement;
