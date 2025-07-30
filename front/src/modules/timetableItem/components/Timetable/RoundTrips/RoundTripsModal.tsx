import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useTimetableItemsWithPathOps from 'applications/operationalStudies/hooks/useTimetableItemsWithPathOps';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import { mapBy } from 'utils/types';

import OneWaysColumn from './OneWaysColumn';
import RoundTripsColumn from './RoundTripsColumn';
import TodoColumn from './TodoColumn';
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
  const [itemIdToPair, setItemIdToPair] = useState<TimetableItemId>();

  const { data: { results: subCategories } = { results: [] } } =
    osrdEditoastApi.endpoints.getSubCategory.useQuery({
      pageSize: 100,
    });

  const timetableItemsWithOps = useTimetableItemsWithPathOps(infraId, timetableItems);

  const timetableItemsWithOpsById = useMemo(
    () => mapBy(timetableItemsWithOps, 'id'),
    [timetableItemsWithOps]
  );

  const pairingItemsById = useMemo(() => mapBy(pairingItems, 'id'), [pairingItems]);

  const pairingItemsByColumn = useMemo(
    () =>
      pairingItems.reduce<{
        todo: PairingItem[];
        oneWays: PairingItem[];
        roundTrips: { pair: [PairingItem, PairingItem]; isValid: boolean }[];
      }>(
        (acc, item) => {
          if (item.status === 'todo') {
            acc.todo.push(item);
          }
          if (item.status === 'oneWays') {
            acc.oneWays.push(item);
          }
          // TODO : handle roundtrips column
          return acc;
        },
        { todo: [], oneWays: [], roundTrips: [] }
      ),
    [pairingItems]
  );

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
      <div className={cx('round-trips-modal-body', { 'pairing-body': !!itemIdToPair })}>
        <TodoColumn
          pairingItems={pairingItemsByColumn.todo}
          setPairingItems={setPairingItems}
          itemIdToPair={itemIdToPair}
          setItemIdToPair={setItemIdToPair}
          timetableItemsWithOpsById={timetableItemsWithOpsById}
          pairingItemsById={pairingItemsById}
          subCategories={subCategories}
        />
        <OneWaysColumn
          pairingItems={pairingItemsByColumn.oneWays}
          setPairingItems={setPairingItems}
          hideColumn={!!itemIdToPair}
          subCategories={subCategories}
        />
        <RoundTripsColumn
          pairingItems={pairingItemsByColumn.roundTrips}
          setPairingItems={setPairingItems}
          hideColumn={!!itemIdToPair}
          subCategories={subCategories}
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
