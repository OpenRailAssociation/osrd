import { useContext } from 'react';

import { ModalContext } from './ModalProvider';

export default function useModal() {
  const { openModal, closeModal } = useContext(ModalContext);
  return {
    openModal,
    closeModal,
  };
}
