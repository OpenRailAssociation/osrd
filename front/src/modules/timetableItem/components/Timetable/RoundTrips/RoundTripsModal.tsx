import { useEffect, useRef } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import RoundTripsModalColumn from './RoundTripsModalColumn';

type RoundTripsModalProps = {
  roundTripsModalIsOpen: boolean;
  setRoundTripsModalIsOpen: (isOpen: boolean) => void;
};

const RoundTripsModal = ({
  roundTripsModalIsOpen,
  setRoundTripsModalIsOpen,
}: RoundTripsModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main',
  });
  const { t: commonT } = useTranslation('translation', {
    keyPrefix: 'common',
  });

  const modalRef = useRef<HTMLDialogElement>(null);

  const openModal = () => {
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
    setRoundTripsModalIsOpen(false);
  };

  useModalFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (roundTripsModalIsOpen) {
      openModal();
    }
  }, [roundTripsModalIsOpen]);

  return (
    <dialog ref={modalRef} className="round-trips-modal">
      <div className="round-trips-modal-header">
        <h1 className="title">{t('roundTripsModal.roundTripsManagement')}</h1>
      </div>
      <div className="round-trips-modal-body">
        <RoundTripsModalColumn type="todo" pairingItems={[]} />
        <RoundTripsModalColumn type="oneWays" pairingItems={[]} />
        <RoundTripsModalColumn type="roundTrips" pairingItems={[]} />
      </div>
      <div className="round-trips-modal-footer">
        <Button label={commonT('cancel')} variant="Cancel" size="medium" onClick={closeModal} />
        <Button label={commonT('saveEdits')} variant="Primary" size="medium" onClick={closeModal} />
      </div>
    </dialog>
  );
};

export default RoundTripsModal;
