import React, { useContext } from 'react';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import RollingStockSelector from './RollingStockSelectorTest';

const RollingStockModal = () => {
  const { closeModal } = useContext(ModalContext);

  return (
    <ModalBodySNCF style={{ paddingBottom: 0 }}>
      <button type="button" className="close" aria-label="Close" onClick={closeModal}>
        <span aria-hidden="true">&times;</span>
      </button>
      <RollingStockSelector />
    </ModalBodySNCF>
  );
};

export default RollingStockModal;
