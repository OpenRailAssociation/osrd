import { useEffect, useEffectEvent } from 'react';

const useOutsideClick = (
  ref: React.RefObject<HTMLElement | null> | null,
  handler: (event: MouseEvent) => void
) => {
  const handleClickOutside = useEffectEvent((event: MouseEvent) => {
    if (ref?.current && !ref.current.contains(event.target as Node)) {
      handler(event);
    }
  });

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
};

export default useOutsideClick;
