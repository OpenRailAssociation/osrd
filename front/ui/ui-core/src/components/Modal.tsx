import React, { useEffect, useRef } from 'react';

import { X } from '@osrd-project/ui-icons';

import { useModalPosition } from '../hooks/useModalPosition';
import useOutsideClick from '../hooks/useOutsideClick';

type ModalProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testIdPrefix?: string;
};

const InputModal = ({ inputRef, isOpen, onClose, children, testIdPrefix }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { modalPosition, calculatePosition } = useModalPosition(inputRef, modalRef);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [calculatePosition, isOpen]);

  useOutsideClick(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="ui-modal-overlay">
      <div
        ref={modalRef}
        className="modal-content"
        style={{ top: modalPosition.top, left: modalPosition.left }}
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
    </div>
  );
};

export default InputModal;
