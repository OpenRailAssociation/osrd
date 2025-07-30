import { useLayoutEffect, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import useModalFocusTrap from '../utils/hooks/useModalFocusTrap';

type AnchoreMenuParams = {
  children?: React.ReactNode;
  anchorRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  container?: Element | null;
  alignment?: 'left' | 'right' | 'auto';
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
}: AnchoreMenuParams) => {
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    left: number;
    bottom?: number;
  }>();

  const menuRef = useRef<HTMLDivElement>(null);
  const shouldDisplayMenu = Boolean(children);

  useLayoutEffect(() => {
    const anchorRefBoundingRect = anchorRef.current?.getBoundingClientRect();
    const menuRefBoundingRect = menuRef.current?.getBoundingClientRect();

    if (anchorRefBoundingRect && menuRefBoundingRect && menuRefBoundingRect.width > 0) {
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
    }
  }, [anchorRef, shouldDisplayMenu]);

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
