import { useEffect } from 'react';

/**
 * Allow the user to escape the modal by pressing escape and to trap the focus inside it
 * */

export default function useModalFocusTrap(
  modalRef: React.RefObject<HTMLDivElement>,
  closeModal: () => void
) {
  useEffect(() => {
    const modalElement = modalRef.current;

    const focusableElements = modalElement?.querySelectorAll(
      // last declaration stands for all elements not natively focusable like li
      'input, button, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0];
    const lastElement = focusableElements?.[focusableElements?.length - 1];

    /**
     *
     * Prevent the tab event and set focus on :
     * - last element if we are pressing on "shift" in addition to "tab" and are on the first element
     * - first element if we are only pressing "tab" and are on the last element
     */
    const handleTabKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && firstElement && lastElement) {
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          (lastElement as HTMLElement).focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          (firstElement as HTMLElement).focus();
        }
      }
    };

    const handleEscapeKeyPress: (event: KeyboardEvent) => void = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    modalElement?.addEventListener('keydown', handleTabKeyPress);
    modalElement?.addEventListener('keydown', handleEscapeKeyPress);

    return () => {
      modalElement?.removeEventListener('keydown', handleTabKeyPress);
      modalElement?.removeEventListener('keydown', handleEscapeKeyPress);
    };
  }, [modalRef, closeModal]);
}
