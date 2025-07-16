import { useEffect, useMemo, useRef } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import useTimetableItemsWithPathOps from 'applications/operationalStudies/hooks/useTimetableItemsWithPathOps';
import type { TimetableItem } from 'reducers/osrdconf/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import RoundTripsModalColumn from './RoundTripsModalColumn';
import formatPairingItems from './utils';

type RoundTripsModalProps = {
  roundTripsModalIsOpen: boolean;
  setRoundTripsModalIsOpen: (isOpen: boolean) => void;
  infraId: number;
  timetableItems: TimetableItem[];
};

const RoundTripsModal = ({
  roundTripsModalIsOpen,
  setRoundTripsModalIsOpen,
  infraId,
  timetableItems,
}: RoundTripsModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main',
  });
  const { t: commonT } = useTranslation('translation', {
    keyPrefix: 'common',
  });

  const modalRef = useRef<HTMLDialogElement>(null);

  const timetableItemsWithOps = useTimetableItemsWithPathOps(infraId, timetableItems);

  // TODO : Handle format with pairing items when back is ready in issue https://github.com/OpenRailAssociation/osrd/issues/12376
  const { todo } = useMemo(
    () => formatPairingItems(timetableItemsWithOps, t),
    [timetableItemsWithOps, t]
  );

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
        <RoundTripsModalColumn type="todo" pairingItems={todo} />
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
