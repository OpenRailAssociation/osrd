import React, { useContext } from 'react';
import { ModalContext } from './ModalProvider';

type Props = {
  children: JSX.Element;
  withCloseButton?: boolean;
  withBorderBottom?: boolean;
};

export default function ModalHeaderSNCF({
  children,
  withCloseButton = false,
  withBorderBottom = false,
}: Props) {
  const { closeModal } = useContext(ModalContext);
  return (
    <>
      <div className="modal-header">
        {children}
        {withCloseButton && (
          <button type="button" className="close" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
        )}
      </div>
      {withBorderBottom ? (
        <div className="modal-header modal-header-border-bottom">
          <div />
        </div>
      ) : null}
    </>
  );
}
