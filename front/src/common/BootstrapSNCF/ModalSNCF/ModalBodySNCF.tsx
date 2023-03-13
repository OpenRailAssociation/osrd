import React, { FC, PropsWithChildren } from 'react';

const ModalBodySNCF: FC<PropsWithChildren<unknown>> = ({ children }) => (
  <div id="modal-body" className="modal-body">
    {children}
  </div>
);

export default ModalBodySNCF;
