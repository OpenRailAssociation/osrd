import { useState, useEffect, useCallback } from 'react';

export const usePopoverPosition = (
  inputRef: React.RefObject<HTMLElement | null>,
  popoverRef: React.RefObject<HTMLElement | null>,
  verticalOffset: number = -3, // Default offset below the input
  align: 'center' | 'start' = 'center',
  verticalAnchor: 'bottom' | 'top' = 'bottom'
) => {
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const calculatePosition = useCallback(() => {
    if (inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.getBoundingClientRect()?.width ?? 0;

      const anchorY = verticalAnchor === 'top' ? inputRect.top : inputRect.bottom;
      const top = anchorY + window.scrollY + verticalOffset;

      const isCentered = align === 'center';
      const popoverViewportLeft =
        inputRect.left + window.scrollX + (isCentered ? inputRect.width / 2 : 0);
      // When centered, the popover is shifted by half its width
      const offsetX = isCentered ? popoverWidth / 2 : 0;

      // Keep popover inside the viewport bounds horizontally
      const left = Math.max(
        offsetX,
        Math.min(popoverViewportLeft, window.innerWidth - popoverWidth + offsetX)
      );

      setPopoverPosition({ top, left });
    }
  }, [inputRef, popoverRef, verticalOffset, align, verticalAnchor]);

  useEffect(() => {
    const handleResizeScroll = () => calculatePosition();
    window.addEventListener('resize', handleResizeScroll);
    // TODO: Get rid of this as soon as we can, using CSS native anchoring
    window.addEventListener('scroll', handleResizeScroll, true);
    return () => {
      window.removeEventListener('resize', handleResizeScroll);
      window.removeEventListener('scroll', handleResizeScroll, true);
    };
  }, [calculatePosition]);

  return { popoverPosition, calculatePosition };
};
