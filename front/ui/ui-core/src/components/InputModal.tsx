import React, { useEffect, useRef } from 'react';

import { X } from '@osrd-project/ui-icons';

import { useModalPosition } from '../hooks/useModalPosition';
import useOutsideClick from '../hooks/useOutsideClick';

type ModalProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  offset?: number;
  testIdPrefix?: string;
};

const InputModal = ({ inputRef, isOpen, onClose, children, offset, testIdPrefix }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { modalPosition, calculatePosition } = useModalPosition(inputRef, modalRef, offset);

  useEffect(() => {
    if (isOpen && modalRef.current && !modalRef.current.matches(':popover-open')) {
      modalRef.current.showPopover();
      calculatePosition();
    }
  }, [isOpen, modalRef, calculatePosition]);

  useOutsideClick(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="input-modal"
      style={{ top: modalPosition.top, left: modalPosition.left }}
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

export default InputModal;
