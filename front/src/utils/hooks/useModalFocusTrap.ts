import { useEffect } from 'react';

/**
 * Allow the user to escape the modal by pressing escape and to trap the focus inside it
 * */

export default function useModalFocusTrap(
  modalRef: React.RefObject<HTMLDivElement | HTMLDialogElement | null>,
  closeModal: () => void,
  { focusOnFirstElement = false } = {}
) {
  useEffect(() => {
    const modalElement = modalRef.current;

    const focusableElements = modalElement?.querySelectorAll(
      // last declaration stands for all elements not natively focusable like li
      'input, button, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements?.length - 1] as HTMLElement;

    if (focusOnFirstElement) firstElement?.focus();

    /**
     *
     * Prevent the tab event and set focus on :
     * - last element if we are pressing on "shift" in addition to "tab" and are on the first element
     * - first element if we are only pressing "tab" and are on the last element
     */
    const handleTabKeyPress: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Tab') {
        if (keyboardEvent.shiftKey && document.activeElement === firstElement) {
          keyboardEvent.preventDefault();
          lastElement.focus();
        } else if (!keyboardEvent.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
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

    document.addEventListener('keydown', handleTabKeyPress);
    document.addEventListener('keydown', handleEscapeKeyPress);

    return () => {
      document.removeEventListener('keydown', handleTabKeyPress);
      document.removeEventListener('keydown', handleEscapeKeyPress);
    };
  }, [modalRef, closeModal]);
}
