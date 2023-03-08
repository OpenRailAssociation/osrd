import React, { FC, PropsWithChildren } from 'react';
import { isArray } from 'lodash';

import ModalHeaderSNCF from './ModalHeaderSNCF';
import ModalFooterSNCF from './ModalFooterSNCF';
import ModalBodySNCF from './ModalBodySNCF';

export interface ModalProps {
  title?: string;
  withCloseButton?: boolean;
}

export const Modal: FC<PropsWithChildren<ModalProps>> = ({
  children,
  title,
  withCloseButton = true,
}) => {
  const childrenArray = isArray(children) ? children : [children];
  const body = childrenArray[0];
  const footer = childrenArray[1];

  return (
    <>
      {title && (
        <ModalHeaderSNCF withCloseButton={withCloseButton}>
          <h5>{title}</h5>
        </ModalHeaderSNCF>
      )}
      <ModalBodySNCF>{body}</ModalBodySNCF>
      {footer && <ModalFooterSNCF>{footer}</ModalFooterSNCF>}
    </>
  );
};
