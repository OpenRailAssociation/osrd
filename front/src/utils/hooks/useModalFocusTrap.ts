import { useEffect } from 'react';

/**
 * Allow the user to escape the modal by pressing escape and to trap the focus inside it
 * + expose input mode (keyboard vs pointer) via documentElement dataset
 */
export default function useModalFocusTrap(
  modalRef: React.RefObject<HTMLElement | null>,
  closeModal: () => void,
  { focusOnFirstElement = false } = {}
) {
  useEffect(() => {
    const modalElement = modalRef.current;

    const setInputMode = (mode: 'keyboard' | 'pointer') => {
      document.documentElement.dataset.opInputMode = mode;
    };

    const focusableElements = modalElement?.querySelectorAll(
      // last declaration stands for all elements not natively focusable like li
      'input, button, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements?.length - 1] as HTMLElement;

    if (focusOnFirstElement) firstElement?.focus();

    const handleTabKeyPress: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Tab') {
        setInputMode('keyboard');

        if (keyboardEvent.shiftKey && document.activeElement === firstElement) {
          keyboardEvent.preventDefault();
          lastElement.focus();
        } else if (!keyboardEvent.shiftKey && document.activeElement === lastElement) {
          keyboardEvent.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscapeKeyPress: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Escape') {
        closeModal();
      }
    };

    const handleKeyboardMode: EventListener = (event) => {
      const e = event as KeyboardEvent;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setInputMode('keyboard');
      }
    };

    const handlePointerMode: EventListener = () => {
      setInputMode('pointer');
    };

    document.addEventListener('keydown', handleTabKeyPress);
    document.addEventListener('keydown', handleEscapeKeyPress);

    document.addEventListener('keydown', handleKeyboardMode, true);
    modalElement?.addEventListener('mousemove', handlePointerMode, true);
    modalElement?.addEventListener('mousedown', handlePointerMode, true);

    return () => {
      document.removeEventListener('keydown', handleTabKeyPress);
      document.removeEventListener('keydown', handleEscapeKeyPress);

      document.removeEventListener('keydown', handleKeyboardMode, true);
      modalElement?.removeEventListener('mousemove', handlePointerMode, true);
      modalElement?.removeEventListener('mousedown', handlePointerMode, true);
    };
  }, [modalRef, closeModal, focusOnFirstElement]);
}
