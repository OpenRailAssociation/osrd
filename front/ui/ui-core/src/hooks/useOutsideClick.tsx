import { useEffect, useEffectEvent } from 'react';

type UseOutsideClickOptions = {
  blockOutsideClick?: boolean;
};

const blockEvent = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * Blocks the click following the current mousedown.
 * The blocker is dropped on the next mousedown outside the current element.
 */
const blockNextClick = () => {
  const controller = new AbortController();
  const options = { capture: true, signal: controller.signal };
  document.addEventListener(
    'click',
    (event) => {
      blockEvent(event);
      controller.abort();
    },
    options
  );
  document.addEventListener('mousedown', () => controller.abort(), options);
};

const useOutsideClick = (
  ref: React.RefObject<HTMLElement | null> | null,
  handler: (event: MouseEvent) => void,
  { blockOutsideClick = false }: UseOutsideClickOptions = {}
) => {
  const handleClickOutside = useEffectEvent((event: MouseEvent) => {
    if (ref?.current && !ref.current.contains(event.target as Node)) {
      if (blockOutsideClick) {
        blockEvent(event);
        blockNextClick();
      }
      handler(event);
    }
  });

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside, { capture: blockOutsideClick });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: blockOutsideClick });
    };
  }, [blockOutsideClick]);
};

export default useOutsideClick;
