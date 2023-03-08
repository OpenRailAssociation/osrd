import React, {
  FC,
  PropsWithChildren,
  ReactNode,
  useState,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import cx from 'classnames';

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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  openModal: (_content) => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  closeModal: () => {},
};

/**
 * Modal react context
 */
export const ModalContext = createContext(initialModalContext);

export const ModalSNCF: FC = () => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { isOpen, content, closeModal, size, className } = useContext(ModalContext);

  /**
   * Register click outside event to close the modal.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        event.target &&
        isOpen &&
        modalRef.current &&
        !modalRef.current.contains(event.target as HTMLElement)
      ) {
        closeModal();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return function cleanup() {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeModal]);

  return (
    <>
      {isOpen && (
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
            <div className="modal-content">{content}</div>
          </div>
        </div>
      )}
    </>
  );
};

/*
 * Provider of the modal context
 */
export const ModalProvider: FC<PropsWithChildren<unknown>> = ({ children }) => {
  const location = useLocation();
  const [modalContext, setModalContext] = useState<ModalContextType>(initialModalContext);

  const openModal: ModalContextType['openModal'] = useCallback((content, size, className) => {
    setModalContext((prev) => ({
      ...prev,
      isOpen: true,
      size,
      className,
      content,
    }));
    document.body.classList.add('modal-open');
  }, []);

  const closeModal = useCallback(() => {
    setModalContext((prev) => ({
      ...prev,
      isOpen: false,
      size: undefined,
      className: undefined,
      content: null,
    }));
    document.body.classList.remove('modal-open');
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
   * => close modal on route change
   */
  useEffect(() => {
    closeModal();
  }, [location]);

  return (
    <ModalContext.Provider value={modalContext}>
      {children}
      {modalContext.content && (
        <div className={cx('modal-backdrop fade', modalContext.isOpen && 'show')} />
      )}
      <ModalSNCF />
    </ModalContext.Provider>
  );
};

export default ModalSNCF;
