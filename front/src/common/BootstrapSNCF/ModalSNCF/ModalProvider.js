import React, { useState, createContext, useContext, useEffect } from 'react';

const ModalContext = createContext({
  isModalOpen: false,
  modalContent: null,
  openModal: (content, size, optionalClasses = '', withCloseButton = false) => {},
  closeModal: () => {},
  size: undefined,
  optionalClasses: '',
  withCloseButton: false,
});

function ModalProvider({ children }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [size, setSize] = useState(undefined);
  const [optionalClasses, setOptionalClasses] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [withCloseButton, setWithCloseButton] = useState(false);

  const openModal = (
    content,
    sizeSetting,
    optionalClassesSetting = '',
    withCloseButtonSetting = false
  ) => {
    setModalContent(content);
    setIsModalOpen(true);
    setSize(sizeSetting);
    setOptionalClasses(optionalClassesSetting);
    setWithCloseButton(withCloseButtonSetting);
    document.body.classList.add('modal-open');
    setTimeout(() => setIsVisible(true), 0);
  };

  const closeModal = () => {
    setModalContent(null);
    setIsModalOpen(false);
    setSize(undefined);
    setOptionalClasses('');
    document.body.classList.remove('modal-open');
    setIsVisible(false);
  };

  return (
    <ModalContext.Provider
      // eslint-disable-next-line react/jsx-no-constructed-context-values
      value={{
        isModalOpen,
        modalContent,
        openModal,
        closeModal,
        optionalClasses,
        size,
        isVisible,
        withCloseButton,
      }}
    >
      {children}
      {isModalOpen && modalContent && (
        <div className={`modal-backdrop fade ${isVisible ? 'show' : ''}`} />
      )}
    </ModalContext.Provider>
  );
}

function ModalSNCF() {
  const { isModalOpen, modalContent, closeModal, size, optionalClasses, isVisible } =
    useContext(ModalContext);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }
    const handleClickOutside = (event) => {
      if (event.target.classList.contains('modal')) {
        closeModal();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return function cleanup() {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  const modalClasses =
    size !== undefined ? ` modal-${size} ${optionalClasses}` : `${optionalClasses}`;

  return (
    <div
      className={`modal fade ${isVisible ? 'show' : ''}`}
      style={{ display: 'block' }}
      tabIndex="-1"
      role="dialog"
      aria-hidden="true"
    >
      <div className={`modal-dialog modal-dialog-centered ${modalClasses}`} role="document">
        <div className="modal-content">{modalContent}</div>
      </div>
    </div>
  );
}

export { ModalProvider, ModalContext, ModalSNCF };
