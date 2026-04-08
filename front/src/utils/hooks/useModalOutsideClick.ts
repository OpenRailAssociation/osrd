import { useCallback, useContext, useState } from 'react';

import { useOutsideClick } from '@osrd-project/ui-core';

import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

/**
 * Wraps `useOutsideClick` with unsaved-changes detection for modal dialogs.
 *
 * When the user clicks outside the modal:
 * - if there are unsaved changes, a confirmation prompt is shown (`clickedOutside = true`)
 * - otherwise the modal is closed directly
 */
const useModalOutsideClick = (modalRef: React.RefObject<HTMLElement | null>) => {
  const { closeModal } = useContext(ModalContext);

  const [clickedOutside, setClickedOutside] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const resetClickedOutside = useCallback(() => setClickedOutside(false), []);

  useOutsideClick(modalRef, () => {
    if (hasChanges) {
      setClickedOutside(true);
    } else {
      closeModal();
    }
  });

  return { clickedOutside, setHasChanges, resetClickedOutside };
};

export default useModalOutsideClick;
