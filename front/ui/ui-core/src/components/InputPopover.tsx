import React, { useEffect, useRef } from 'react';

import { X } from '@osrd-project/ui-icons';

import useOutsideClick from '../hooks/useOutsideClick';
import { usePopoverPosition } from '../hooks/usePopoverPosition';

type PopoverProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  verticalOffset?: number;
  testIdPrefix?: string;
};

const InputPopover = ({
  inputRef,
  isOpen,
  onClose,
  children,
  verticalOffset,
  testIdPrefix,
}: PopoverProps) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { popoverPosition, calculatePosition } = usePopoverPosition(
    inputRef,
    popoverRef,
    verticalOffset
  );

  useEffect(() => {
    if (isOpen && popoverRef.current && !popoverRef.current.matches(':popover-open')) {
      popoverRef.current.showPopover();
      calculatePosition();
    }
  }, [isOpen, modalRef, calculatePosition]);

  useOutsideClick(popoverRef, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="input-popover"
      style={{ top: popoverPosition.top, left: popoverPosition.left }}
      popover="manual"
    >
      <button
        data-testid={testIdPrefix ? `${testIdPrefix}-close-button` : undefined}
        className="close-button"
        onClick={onClose}
      >
        <X size="lg" />
      </button>
      {children}
    </div>
  );
};

export default InputPopover;
