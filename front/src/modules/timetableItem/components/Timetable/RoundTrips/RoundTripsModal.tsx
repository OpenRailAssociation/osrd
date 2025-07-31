import { useEffect, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import useTimetableItemsWithPathOps from 'applications/operationalStudies/hooks/useTimetableItemsWithPathOps';
import type { TimetableItem } from 'reducers/osrdconf/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import RoundTripsModalColumn from './RoundTripsModalColumn';
import formatPairingItems from './utils';
import type { PairingItem } from '../types';

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

  const [pairingItems, setPairingItems] = useState<PairingItem[]>([]);

  const timetableItemsWithOps = useTimetableItemsWithPathOps(infraId, timetableItems);

  const openModal = () => {
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
    setRoundTripsModalIsOpen(false);
  };

  useModalFocusTrap(modalRef, closeModal);

  // TODO : Handle format with pairing items when back is ready in issue https://github.com/OpenRailAssociation/osrd/issues/12376
  useEffect(() => {
    setPairingItems(formatPairingItems(timetableItemsWithOps, t));
  }, [timetableItemsWithOps, t]);

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
        <RoundTripsModalColumn
          type="todo"
          pairingItems={pairingItems.filter((item) => item.status === 'todo')}
          setPairingItems={setPairingItems}
        />
        <RoundTripsModalColumn
          type="oneWays"
          pairingItems={pairingItems.filter((item) => item.status === 'oneWays')}
          setPairingItems={setPairingItems}
        />
        <RoundTripsModalColumn
          type="roundTrips"
          pairingItems={[]}
          setPairingItems={setPairingItems}
        />
      </div>
      <div className="round-trips-modal-footer">
        <Button label={commonT('cancel')} variant="Cancel" size="medium" onClick={closeModal} />
        <Button label={commonT('saveEdits')} variant="Primary" size="medium" onClick={closeModal} />
      </div>
    </dialog>
  );
};

export default RoundTripsModal;
