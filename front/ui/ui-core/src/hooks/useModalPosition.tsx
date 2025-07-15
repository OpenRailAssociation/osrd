import { useState, useEffect, useCallback } from 'react';

export const useModalPosition = (
  inputRef: React.RefObject<HTMLInputElement | null>,
  modalRef: React.RefObject<HTMLDivElement | null>,
  offset: number = 3 // Default offset below the input
) => {
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const calculatePosition = useCallback(() => {
    if (inputRef.current && modalRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const modal = modalRef.current;
      const modalRect = modal.getBoundingClientRect();

      const offsetParent = modal.offsetParent;
      const parentRect = offsetParent ? offsetParent.getBoundingClientRect() : { top: 0, left: 0 };

      // Adjust the top position: place it below the input while considering an offset
      const top = inputRect.bottom - parentRect.top - offset;

      // Center the modal horizontally relative to the input
      const modalViewportLeft = inputRect.left + (inputRect.width - modalRect.width) / 2;

      // Keep modal to stay within viewport bounds
      const adjustedViewportLeft = Math.max(
        0,
        Math.min(modalViewportLeft, window.innerWidth - modalRect.width)
      );

      const left = adjustedViewportLeft - parentRect.left;

      setModalPosition({ top, left });
    }
  }, [inputRef, modalRef, offset]);

  useEffect(() => {
    calculatePosition();
    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePosition]);

  return { modalPosition, calculatePosition };
};
