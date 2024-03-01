import React, { type FC, type PropsWithChildren } from 'react';

const ModalFooterSNCF: FC<PropsWithChildren<unknown>> = ({ children }) => (
  <div className="modal-footer">{children}</div>
);

export default ModalFooterSNCF;
