import { useRef, useState, useEffect, useMemo } from 'react';

import { debounce } from 'lodash';

const DEBOUNCE = 100;
const SCROLL_THRESHOLD = 24; // half the width of a scroll button

const useHorizontalScroll = (itemSelectorClassname: string, itemToShowCount: number) => {
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [showLeftBtn, setShowLeftBtn] = useState(false);
  const [showRightBtn, setShowRightBtn] = useState(false);
  const selector = `.${itemSelectorClassname}`;

  // Calculate the width of an item including its margin-right and margin-left
  const calculateItemWidthHorizontalMargins = (item: Element) => {
    const style = window.getComputedStyle(item);
    const marginRight = parseFloat(style.marginRight);
    const marginLeft = parseFloat(style.marginLeft);
    const itemWidth = item.getBoundingClientRect().width;
    return itemWidth + marginRight + marginLeft;
  };

  // Calculate the scroll distance required to show the specified number of items
  const calculateScrollDistance = () => {
    const scrollable = scrollableRef.current;
    if (scrollable) {
      const items = scrollable.querySelectorAll(selector);
      if (items.length > 0) {
        const itemWidthWithMargins = calculateItemWidthHorizontalMargins(items[0]);
        return itemWidthWithMargins * itemToShowCount;
      }
    }
    return 0;
  };

  // Calculate the total width of all items inside the scrollable container
  const calculateTotalItemsWidth = () => {
    const scrollable = scrollableRef.current;
    if (scrollable) {
      const items = scrollable.querySelectorAll(selector);
      let totalWidth = 0;
      items.forEach((item) => {
        totalWidth += calculateItemWidthHorizontalMargins(item);
      });
      return totalWidth;
    }
    return 0;
  };

  // Update the visibility of the left and right scroll buttons based on scroll position and content width
  const updateButtonsVisibility = () => {
    const scrollable = scrollableRef.current;
    if (scrollable) {
      const totalItemWidth = calculateTotalItemsWidth();
      const contentExceedsVisibleWidth = totalItemWidth > scrollable.clientWidth;
      const remainingScrollWidth =
        totalItemWidth - (scrollable.scrollLeft + scrollable.clientWidth);
      const canScrollRight = remainingScrollWidth > SCROLL_THRESHOLD;

      setShowLeftBtn(scrollable.scrollLeft > 0);
      setShowRightBtn(contentExceedsVisibleWidth && canScrollRight);
    }
  };

  const scrollLeft = () => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollLeft += -calculateScrollDistance();
    }
  };

  const scrollRight = () => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollLeft += calculateScrollDistance();
    }
  };

  const debouncedUpdateButtonsVisibility = useMemo(
    () => debounce(updateButtonsVisibility, DEBOUNCE),
    []
  );

  useEffect(() => {
    const scrollable = scrollableRef.current;

    // Initial update of button visibility
    updateButtonsVisibility();

    // Event handlers
    const handleResize = () => updateButtonsVisibility();
    const handleScroll = () => debouncedUpdateButtonsVisibility();

    if (scrollable) {
      // Set up event listeners for scroll and resize
      scrollable.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleResize);

      // Set up MutationObserver to detect DOM changes
      const observer = new MutationObserver(() => {
        updateButtonsVisibility();
      });
      observer.observe(scrollable, { childList: true });

      // Cleanup function
      return () => {
        scrollable.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
        observer.disconnect();
      };
    }
    return () => {};
  }, [debouncedUpdateButtonsVisibility]);

  return { scrollableRef, showLeftBtn, showRightBtn, scrollLeft, scrollRight };
};

export default useHorizontalScroll;
