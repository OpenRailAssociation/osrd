import { FC, PropsWithChildren } from 'react';

const ModalBodySNCF: FC<PropsWithChildren<unknown>> = ({ children }) => (
  <div className="modal-body">{children}</div>
);

export default ModalBodySNCF;
