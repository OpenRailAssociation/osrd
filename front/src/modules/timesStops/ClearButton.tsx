import { useState, useLayoutEffect } from 'react';

import { Clear } from '@osrd-project/ui-icons';
import { createPortal } from 'react-dom';

type ClearButtonProps = {
  isVisible: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onClear: () => void;
};

const ClearButton = ({ isVisible, containerRef, onClear }: ClearButtonProps) => {
  const [btnPos, setBtnPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isVisible) {
      setBtnPos(null);
      return undefined;
    }
    const updatePos = () => {
      if (!containerRef.current) return;
      const td = containerRef.current.closest('td');
      if (!td) return;
      const rect = td.getBoundingClientRect();
      setBtnPos({ top: rect.top + rect.height / 2, left: rect.left });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isVisible, containerRef]);

  if (!isVisible || !btnPos) return null;

  return createPortal(
    <button
      type="button"
      className="duration-cell-clear-btn"
      tabIndex={-1}
      style={{ top: btnPos.top, left: btnPos.left }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
    >
      <Clear size="sm" />
    </button>,
    document.body
  );
};

export default ClearButton;
