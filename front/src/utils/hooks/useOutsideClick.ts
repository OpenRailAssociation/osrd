import { useEffect, type RefObject, useState } from 'react';

/**
 * Register click outside event to close the modal.
 * Using setHasChanges allow us to trigger a confirm close modal if needed.
 */
const useOutsideClick = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  callback: (e: MouseEvent) => void,
  isOpen?: boolean
) => {
  const [clickedOutside, setClickedOutside] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const resetClickedOutside = () => {
    setClickedOutside(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !ref.current?.classList.contains('no-close-modal')
      ) {
        if (hasChanges) {
          setClickedOutside(true);
        } else {
          callback(e);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, hasChanges]);

  return { clickedOutside, setHasChanges, resetClickedOutside };
};

export default useOutsideClick;
