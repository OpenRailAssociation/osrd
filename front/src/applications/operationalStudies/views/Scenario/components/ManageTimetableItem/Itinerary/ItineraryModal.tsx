import { useEffect, useRef } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import ItineraryModalMap from './ItineraryModalMap';

type ItineraryModalProps = {
  itineraryModalIsOpen: boolean;
  setItineraryModalIsOpen: (isOpen: boolean) => void;
};

const ItineraryModal = ({ itineraryModalIsOpen, setItineraryModalIsOpen }: ItineraryModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });

  const modalRef = useRef<HTMLDialogElement>(null);

  const openModal = () => {
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
    setItineraryModalIsOpen(false);
  };

  useModalFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (itineraryModalIsOpen) {
      openModal();
    }
  }, [itineraryModalIsOpen]);

  return (
    <dialog ref={modalRef} className="itinerary-modal">
      <div className="itinerary-modal-form">
        <div className="itinerary-modal-form-header"></div>
        <div className="itinerary-modal-form-body"></div>
        <div className="itinerary-modal-form-footer">
          <Button label={t('next')} variant="Primary" size="medium" onClick={closeModal} />
        </div>
      </div>
      <div className="itinerary-modal-map">
        <ItineraryModalMap />
      </div>
    </dialog>
  );
};

export default ItineraryModal;
