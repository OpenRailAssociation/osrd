import React, { useLayoutEffect, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

type AnchoreMenuParams = {
  children?: React.ReactNode;
  anchorRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
};

/**
 * Creates an overlay on the viewport and displays a menu.
 *
 * It takes in the children to be rendered, a reference to the anchor element, and a callback function to dismiss the menu.
 *
 * Clicking outside the menu will trigger the onDismiss callback (most of the time to close the menu).
 *
 */
const AnchoredMenu = ({ children, anchorRef, onDismiss }: AnchoreMenuParams) => {
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

    if (anchorRefBoundingRect && menuRefBoundingRect) {
      setMenuPosition({
        top: anchorRefBoundingRect.bottom,
        left: anchorRefBoundingRect.left,
      });
    }
  }, [anchorRef, shouldDisplayMenu]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onDismiss();
  };

  if (!shouldDisplayMenu) return null;

  return createPortal(
    <div
      style={{ width: '100%', position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 9999 }}
      onClick={handleClick}
    >
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
    document.body
  );
};

export default AnchoredMenu;
