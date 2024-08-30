import React, { type CSSProperties, type PropsWithChildren } from 'react';

const ModalBodySNCF = ({ children, style }: PropsWithChildren<{ style?: CSSProperties }>) => (
  <div id="modal-body" className="modal-body" style={style}>
    {children}
  </div>
);

export default ModalBodySNCF;
