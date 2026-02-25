import { useLayoutEffect, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import useModalFocusTrap from '../utils/hooks/useModalFocusTrap';

type AnchoreMenuParams = {
  children?: React.ReactNode;
  anchorRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  container?: Element | null;
  alignment?: 'left' | 'right' | 'auto';
  focusOnFirstElement?: boolean;
  lockScroll?: boolean;
  /**
   * Controls where the menu appears relative to the anchor.
   * - `'below'` (default): menu opens below or above the anchor (dropdown behaviour).
   * - `'beside'`: menu opens to the right or left of the anchor, tracking the anchor on
   *   scroll/resize. Use `alignItemRef` to vertically align a specific `.menu-item` with the
   *   anchor's centre.
   */
  placement?: 'below' | 'beside';
  /**
   * Only used when `placement='beside'`. Ref to the element that should be vertically centred
   * with the anchor.
   */
  alignItemRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Creates an overlay on the viewport and displays a menu.
 *
 * It takes in the children to be rendered, a reference to the anchor element, and a callback function to dismiss the menu.
 *
 * Clicking outside the menu will trigger the onDismiss callback (most of the time to close the menu).
 *
 * The focus is trapped inside the menu when it is open, and the first focusable element is focused when the menu opens.
 *
 * It handles the space needed by the menu to know if the children should be positioned above or below the anchor element.
 */
const AnchoredMenu = ({
  children,
  anchorRef,
  onDismiss,
  container,
  alignment = 'auto',
  focusOnFirstElement = true,
  lockScroll = true,
  placement = 'below',
  alignItemRef,
}: AnchoreMenuParams) => {
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    left: number;
    bottom?: number;
  }>();

  const menuRef = useRef<HTMLDivElement>(null);
  const shouldDisplayMenu = Boolean(children);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchorRefBoundingRect = anchorRef.current?.getBoundingClientRect();
      const menuRefBoundingRect = menuRef.current?.getBoundingClientRect();

      if (!anchorRefBoundingRect || !menuRefBoundingRect || menuRefBoundingRect.width === 0) return;

      if (placement === 'beside') {
        const targetItem = alignItemRef?.current;
        if (!targetItem) return;

        const targetItemCenterFromMenuTop = targetItem.offsetTop + targetItem.offsetHeight / 2;

        const anchorStyle = window.getComputedStyle(anchorRef.current!);
        const paddingTop = parseFloat(anchorStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(anchorStyle.paddingBottom) || 0;
        const anchorCenterY =
          anchorRefBoundingRect.top +
          anchorRefBoundingRect.height / 2 +
          (paddingTop - paddingBottom) / 2;

        const wouldOverflowRight =
          anchorRefBoundingRect.right + menuRefBoundingRect.width > window.innerWidth;

        setMenuPosition({
          top: anchorCenterY - targetItemCenterFromMenuTop,
          left: wouldOverflowRight
            ? anchorRefBoundingRect.left - menuRefBoundingRect.width
            : anchorRefBoundingRect.right,
        });
        return;
      }

      // Check if there is enough space below the anchor element
      const isSpaceBelow =
        window.innerHeight - anchorRefBoundingRect.bottom > menuRefBoundingRect.height;

      // Check if menu would overflow on the right side of the viewport
      const wouldOverflowRight =
        anchorRefBoundingRect.left + menuRefBoundingRect.width > window.innerWidth;

      // Determine the alignment based on prop and overflow detection
      let boxLeftPosition: number;
      if (alignment === 'right') {
        boxLeftPosition = anchorRefBoundingRect.right - menuRefBoundingRect.width;
      } else if (alignment === 'left') {
        boxLeftPosition = anchorRefBoundingRect.left;
      } else {
        // auto alignment: switch to right alignment if would overflow
        boxLeftPosition = wouldOverflowRight
          ? anchorRefBoundingRect.right - menuRefBoundingRect.width
          : anchorRefBoundingRect.left;
      }

      setMenuPosition({
        top: isSpaceBelow ? anchorRefBoundingRect.bottom : undefined,
        left: boxLeftPosition,
        bottom: isSpaceBelow ? undefined : window.innerHeight - anchorRefBoundingRect.top,
      });
    };

    updatePosition();

    if (placement !== 'beside' || !shouldDisplayMenu) return;

    // Track scroll and resize to keep the menu aligned with the anchor.
    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      // Use requestAnimationFrame so we update at most once per frame while scrolling/resizing.
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };

    window.addEventListener('resize', scheduleUpdate);
    // Use capture=true to also catch scrolls from parent/nested scroll containers.
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [anchorRef, shouldDisplayMenu, alignment, placement, alignItemRef]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onDismiss();
  };

  useModalFocusTrap(menuRef, onDismiss, { focusOnFirstElement: true });

  if (!shouldDisplayMenu) return null;

  return createPortal(
    <div className="menu-overlay" role="menu" tabIndex={-1} onClick={handleClick}>
      <div
        style={{
          top: menuPosition?.top,
          left: menuPosition?.left,
          bottom: menuPosition?.bottom,
          position: 'fixed',
        }}
        ref={menuRef}
      >
        {children}
      </div>
    </div>,
    container || document.body
  );
};

export default AnchoredMenu;
