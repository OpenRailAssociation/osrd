import React, { type CSSProperties, type FC, type PropsWithChildren } from 'react';

const ModalBodySNCF: FC<PropsWithChildren<unknown> & { style?: CSSProperties }> = ({
  children,
  style,
}) => (
  <div id="modal-body" className="modal-body" style={style}>
    {children}
  </div>
);

export default ModalBodySNCF;
