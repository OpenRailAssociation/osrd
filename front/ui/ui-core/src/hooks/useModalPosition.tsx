import { useState, useEffect, useCallback } from 'react';

export const useModalPosition = (
  inputRef: React.RefObject<HTMLInputElement | null>,
  modalRef: React.RefObject<HTMLElement | null>,
  offset: number = -3 // Default offset below the input
) => {
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const calculatePosition = useCallback(() => {
    if (inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const modalWidth = modalRef.current?.getBoundingClientRect()?.width ?? 0;

      // Adjust the top position: place it below the input while considering an offset
      const top = inputRect.bottom + window.scrollY + offset;

      // Center the modal horizontally relative to the input
      const modalViewportLeft = inputRect.left + window.scrollX + inputRect.width / 2;

      // Keep modal to stay within viewport bounds horizontally
      const left = Math.max(
        modalWidth / 2,
        Math.min(modalViewportLeft, window.innerWidth - modalWidth / 2)
      );

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
