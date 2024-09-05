import { type PropsWithChildren, useContext, useEffect } from 'react';

import { isArray } from 'lodash';

import useKeyboardShortcuts from 'utils/hooks/useKeyboardShortcuts';

import ModalBodySNCF from './ModalBodySNCF';
import ModalFooterSNCF from './ModalFooterSNCF';
import ModalHeaderSNCF from './ModalHeaderSNCF';
import { ModalContext } from './ModalProvider';

export interface ModalProps {
  title?: string;
  withCloseButton?: boolean;
}

export const Modal = ({
  children,
  title,
  withCloseButton = true,
}: PropsWithChildren<ModalProps>) => {
  const { closeModal } = useContext(ModalContext);
  const { register } = useKeyboardShortcuts();
  const childrenArray = isArray(children) ? children : [children];
  const body = childrenArray[0];
  const footer = childrenArray[1];

  useEffect(() => {
    register({ code: 'Escape', handler: closeModal });
  }, [closeModal]);

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
