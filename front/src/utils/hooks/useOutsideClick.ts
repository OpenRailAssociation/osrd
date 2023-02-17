import { useEffect, RefObject } from 'react';

const useOutsideClick = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  callback: (e: MouseEvent) => void
): void => {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback(e);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });
};

export default useOutsideClick;
