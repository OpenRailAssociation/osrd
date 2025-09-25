import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Input } from '@osrd-project/ui-core';
import { Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useTimetableItemsWithPathOps from 'applications/operationalStudies/hooks/useTimetableItemsWithPathOps';
import { checkRoundTripCompatible, groupRoundTrips } from 'applications/operationalStudies/utils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import { useDebounce } from 'utils/helpers';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import { mapBy } from 'utils/types';

import OneWaysColumn from './OneWaysColumn';
import RoundTripsColumn from './RoundTripsColumn';
import TodoColumn from './TodoColumn';
import type { PairingItem, RoundTripsColumnPair } from './types';
import { buildRoundTripsPayload, formatPairingItems } from './utils';

type RoundTripsModalProps = {
  roundTripsModalIsOpen: boolean;
  setRoundTripsModalIsOpen: (isOpen: boolean) => void;
  infraId: number;
  timetableId: number;
  timetableItems: TimetableItem[];
  refreshNge: () => Promise<void>;
};

const RoundTripsModal = ({
  roundTripsModalIsOpen,
  setRoundTripsModalIsOpen,
  infraId,
  timetableId,
  timetableItems,
  refreshNge,
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
  const [filter, setFilter] = useState('');
  const debouncedFilter = useDebounce(filter, 300);

  const subCategories = useSubCategoryContext();

  const { data: { results: trainScheduleRoundtrips } = { results: undefined } } =
    osrdEditoastApi.endpoints.getTimetableByIdRoundTripsTrainSchedules.useQuery({
      id: timetableId,
    });

  const { data: { results: pacedTrainRoundtrips } = { results: undefined } } =
    osrdEditoastApi.endpoints.getTimetableByIdRoundTripsPacedTrains.useQuery({ id: timetableId });

  const [postRoundTripsTrainSchedules] =
    osrdEditoastApi.endpoints.postRoundTripsTrainSchedules.useMutation();

  const [deleteRoundTripsTrainSchedules] =
    osrdEditoastApi.endpoints.postRoundTripsTrainSchedulesDelete.useMutation();

  const [postRoundTripsPacedTrains] =
    osrdEditoastApi.endpoints.postRoundTripsPacedTrains.useMutation();

  const [deleteRoundTripsPacedTrains] =
    osrdEditoastApi.endpoints.postRoundTripsPacedTrainsDelete.useMutation();

  const timetableItemsWithOps = useTimetableItemsWithPathOps(infraId, timetableItems);

  const timetableItemsWithOpsById = useMemo(
    () => mapBy(timetableItemsWithOps, 'id'),
    [timetableItemsWithOps]
  );

  const pairingItemsById = useMemo(() => mapBy(pairingItems, 'id'), [pairingItems]);
  const pairingItemsByColumn = useMemo(() => {
    const groupedPairingItems: {
      todo: PairingItem[];
      oneWays: PairingItem[];
      roundTrips: RoundTripsColumnPair[];
    } = { todo: [], oneWays: [], roundTrips: [] };

    for (const item of pairingItemsById.values()) {
      if (
        item.status !== 'roundTrips' &&
        !item.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      ) {
        continue;
      }
      if (item.status === 'todo') {
        groupedPairingItems.todo.push(item);
      }
      if (item.status === 'oneWays') {
        groupedPairingItems.oneWays.push(item);
      }
      if (
        item.status !== 'roundTrips' ||
        groupedPairingItems.roundTrips.some(
          ({ pair: [pairA, pairB] }) => pairA.id === item.id || pairB.id === item.id
        )
      ) {
        continue;
      }

      const timetableItemA = timetableItemsWithOpsById.get(item.id)!;
      const timetableItemB = timetableItemsWithOpsById.get(item.pairedItemId)!;
      const pairingItemB = pairingItemsById.get(item.pairedItemId)!;
      const isValid = checkRoundTripCompatible(timetableItemA, timetableItemB);

      if (
        !item.name.toLowerCase().includes(debouncedFilter.toLowerCase()) &&
        !pairingItemB.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      ) {
        continue;
      }

      groupedPairingItems.roundTrips.push({ pair: [item, pairingItemB], isValid });
    }

    return groupedPairingItems;
  }, [pairingItemsById, timetableItemsWithOpsById, debouncedFilter]);

  const openModal = () => {
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
    setRoundTripsModalIsOpen(false);
  };

  const saveRoundTrips = async () => {
    if (!trainScheduleRoundtrips || !pacedTrainRoundtrips) return;

    const {
      trainScheduleIdsToDelete,
      trainScheduleOneWaysIds,
      trainScheduleRoundTripsIds,
      pacedTrainIdsToDelete,
      pacedTrainOneWaysIds,
      pacedTrainRoundTripsIds,
    } = buildRoundTripsPayload(pairingItems, trainScheduleRoundtrips, pacedTrainRoundtrips);

    const apiCalls = [];
    if (pacedTrainIdsToDelete.length > 0) {
      apiCalls.push(deleteRoundTripsPacedTrains({ body: pacedTrainIdsToDelete }));
    }
    if (trainScheduleIdsToDelete.length > 0) {
      apiCalls.push(deleteRoundTripsTrainSchedules({ body: trainScheduleIdsToDelete }));
    }
    if (pacedTrainRoundTripsIds.length > 0 || pacedTrainOneWaysIds.length > 0) {
      apiCalls.push(
        postRoundTripsPacedTrains({
          roundTrips: { round_trips: pacedTrainRoundTripsIds, one_ways: pacedTrainOneWaysIds },
        })
      );
    }
    if (trainScheduleRoundTripsIds.length > 0 || trainScheduleOneWaysIds.length > 0) {
      apiCalls.push(
        postRoundTripsTrainSchedules({
          roundTrips: {
            round_trips: trainScheduleRoundTripsIds,
            one_ways: trainScheduleOneWaysIds,
          },
        })
      );
    }
    await Promise.all(apiCalls);

    await refreshNge();

    closeModal();
  };

  useModalFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (!trainScheduleRoundtrips || !pacedTrainRoundtrips || timetableItemsWithOpsById.size === 0)
      return;

    const roundTripGroups = groupRoundTrips(timetableItemsWithOpsById, {
      trainSchedules: trainScheduleRoundtrips,
      pacedTrains: pacedTrainRoundtrips,
    });

    setPairingItems(formatPairingItems(roundTripGroups, t));
  }, [trainScheduleRoundtrips, pacedTrainRoundtrips, timetableItemsWithOpsById]);

  useEffect(() => {
    if (roundTripsModalIsOpen) {
      openModal();
    }
  }, [roundTripsModalIsOpen]);

  return (
    <dialog ref={modalRef} className="round-trips-modal" data-testid="round-trips-modal">
      <div className="round-trips-modal-header">
        <h1 className="title">{t('roundTripsModal.roundTripsManagement')}</h1>
        <Input
          id="candidates-filter"
          small
          narrow
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          withIcons={[
            {
              icon: <Filter size="sm" />,
              action: () => {},
              className: cx('filter-input-icon', { disabled: !!itemIdToPair }),
            },
          ]}
          disabled={!!itemIdToPair}
          data-testid="round-trips-filter-input"
        />
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
        <Button
          dataTestID="round-trips-cancel-button"
          label={commonT('cancel')}
          variant="Cancel"
          size="medium"
          onClick={closeModal}
        />
        <Button
          dataTestID="round-trips-save-button"
          label={commonT('saveEdits')}
          variant="Primary"
          size="medium"
          onClick={saveRoundTrips}
        />
      </div>
    </dialog>
  );
};

export default RoundTripsModal;
