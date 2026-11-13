import { useLayoutEffect, useRef, useState } from 'react';

import { truncateTextStart } from 'utils/strings';

/**
 * Crop the start of `text` so that it fits in the element holding the returned ref, keeping the
 * end of the text (for an occurrence, its index) visible. CSS can only put the ellipsis at the
 * start with `direction: rtl`, which reorders names that start and end with a number.
 *
 * The element must keep the width of the full text (for instance with a hidden copy of it), so
 * that cropping the displayed text does not shrink the width it is measured against.
 */
const useStartTruncatedText = (text: string) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayedText, setDisplayedText] = useState(text);

  useLayoutEffect(() => {
    const element = ref.current;
    const context =
      element && typeof ResizeObserver !== 'undefined'
        ? document.createElement('canvas').getContext('2d')
        : null;
    if (!element || !context) {
      setDisplayedText(text);
      return undefined;
    }

    const update = () => {
      const { width } = element.getBoundingClientRect();
      if (!width) {
        setDisplayedText(text);
        return;
      }
      const style = getComputedStyle(element);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      setDisplayedText(truncateTextStart(text, width, (value) => context.measureText(value).width));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [text]);

  return { ref, displayedText };
};

export default useStartTruncatedText;
