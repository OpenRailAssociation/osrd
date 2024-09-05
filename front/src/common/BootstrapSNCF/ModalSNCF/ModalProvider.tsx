import {
  type PropsWithChildren,
  type ReactNode,
  useState,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import cx from 'classnames';
import { noop } from 'lodash';
import { Outlet, useLocation } from 'react-router-dom';

import useOutsideClick from 'utils/hooks/useOutsideClick';

/**
 * Type of the modal context
 */
export interface ModalContextType {
  isOpen: boolean;
  size?: string;
  className?: string;
  content: ReactNode | JSX.Element | null;
  openModal: (
    content: ReactNode | JSX.Element | null,
    size?: string,
    optionalClasses?: string
  ) => void;
  closeModal: () => void;
}

/**
 * Default modal context (used when creating the context)
 */
const initialModalContext: ModalContextType = {
  isOpen: false,
  content: null,
  openModal: noop,
  closeModal: noop,
};

/**
 * Modal react context
 */
export const ModalContext = createContext(initialModalContext);

export const ModalSNCF = () => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { isOpen, content, closeModal, size, className } = useContext(ModalContext);

  useOutsideClick(modalRef, closeModal, isOpen);

  if (!content) {
    return null;
  }
  return (
    <div
      className={cx('modal fade', isOpen && 'show')}
      style={{ display: 'block' }}
      tabIndex={-1}
      role="dialog"
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        className={cx('modal-dialog modal-dialog-centered', className, size && `modal-${size}`)}
        role="document"
      >
        <div id="modal-content" className="modal-content">
          {content}
        </div>
      </div>
    </div>
  );
};

/*
 * Provider of the modal context
 */
export const ModalProvider = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const [modalContext, setModalContext] = useState<ModalContextType>(initialModalContext);

  const openModal: ModalContextType['openModal'] = useCallback((content, size, className) => {
    document.body.classList.add('modal-open');
    setModalContext((prev) => ({
      ...prev,
      isOpen: false,
      size,
      className,
      content,
    }));
    setTimeout(
      () =>
        setModalContext((prev) => ({
          ...prev,
          isOpen: true,
        })),
      0
    );
  }, []);

  const closeModal = useCallback(() => {
    setModalContext((prev) => ({
      ...prev,
      isOpen: false,
    }));
    setTimeout(() => {
      document.body.classList.remove('modal-open');
      setModalContext((prev) => ({
        ...prev,
        isOpen: false,
        size: undefined,
        className: undefined,
        content: null,
      }));
    }, 0);
  }, []);

  /**
   * When functions changes
   * => update the modal context with their new definition
   */
  useEffect(() => {
    setModalContext((prev) => ({ ...prev, closeModal, openModal }));
  }, [closeModal, openModal]);

  /**
   * When route change
   * => close modal on route change (not for search params change)
   */
  useEffect(() => {
    closeModal();
  }, [location.pathname]);

  return (
    <ModalContext.Provider value={modalContext}>
      {children}
      {modalContext.content && (
        <div className={cx('modal-backdrop fade', modalContext.isOpen && 'show')} />
      )}
      <ModalSNCF />
      <Outlet />
    </ModalContext.Provider>
  );
};

export default ModalSNCF;
