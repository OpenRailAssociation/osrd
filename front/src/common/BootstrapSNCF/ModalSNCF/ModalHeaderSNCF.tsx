import React, { useContext, type PropsWithChildren } from 'react';

import { ModalContext } from './ModalProvider';

interface ModalHeaderSNCFProps {
  withCloseButton?: boolean;
  withBorderBottom?: boolean;
}

const ModalHeaderSNCF = ({
  children,
  withCloseButton = false,
  withBorderBottom = false,
}: PropsWithChildren<ModalHeaderSNCFProps>) => {
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
      {withBorderBottom && (
        <div className="modal-header modal-header-border-bottom">
          <div />
        </div>
      )}
    </>
  );
};

export default ModalHeaderSNCF;
