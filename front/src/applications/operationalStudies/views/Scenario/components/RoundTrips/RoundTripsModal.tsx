import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Input } from '@osrd-project/ui-core';
import { Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useTrainSchedulesWithPathOps from 'applications/operationalStudies/hooks/useTrainSchedulesWithPathOps';
import { checkRoundTripCompatible, groupRoundTrips } from 'applications/operationalStudies/utils';
import { osrdEditoastApi, type TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { useDebounce } from 'utils/hooks/useDebounce';
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
  trainSchedules: TrainScheduleResponse[];
  refreshNge: () => Promise<void>;
};

const RoundTripsModal = ({
  roundTripsModalIsOpen,
  setRoundTripsModalIsOpen,
  infraId,
  timetableId,
  trainSchedules,
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
  const [itemIdToPair, setItemIdToPair] = useState<number>();
  const [filter, setFilter] = useState('');
  const debouncedFilter = useDebounce(filter, 300);

  const subCategories = useSubCategoryContext();

  const { data: { results: pacedTrainRoundtrips } = { results: undefined } } =
    osrdEditoastApi.endpoints.getTimetableByIdRoundTrips.useQuery({
      id: timetableId,
    });

  const [postRoundTrips] = osrdEditoastApi.endpoints.postRoundTrips.useMutation();
  const [deleteRoundTrips] = osrdEditoastApi.endpoints.postRoundTripsDelete.useMutation();

  const trainSchedulesWithOps = useTrainSchedulesWithPathOps(infraId, trainSchedules);

  const trainSchedulesWithOpsById = useMemo(
    () => mapBy(trainSchedulesWithOps, 'id'),
    [trainSchedulesWithOps]
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

      const trainScheduleA = trainSchedulesWithOpsById.get(item.id)!;
      const trainScheduleB = trainSchedulesWithOpsById.get(item.pairedItemId)!;
      const pairingItemB = pairingItemsById.get(item.pairedItemId)!;
      const isValid = checkRoundTripCompatible(trainScheduleA, trainScheduleB);

      if (
        !item.name.toLowerCase().includes(debouncedFilter.toLowerCase()) &&
        !pairingItemB.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      ) {
        continue;
      }

      groupedPairingItems.roundTrips.push({ pair: [item, pairingItemB], isValid });
    }

    return groupedPairingItems;
  }, [pairingItemsById, trainSchedulesWithOpsById, debouncedFilter]);

  const openModal = () => {
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
    setRoundTripsModalIsOpen(false);
  };

  const saveRoundTrips = async () => {
    if (!pacedTrainRoundtrips) return;

    const { idsToDelete, oneWaysIds, roundTripsIds } = buildRoundTripsPayload(
      pairingItems,
      pacedTrainRoundtrips
    );

    const apiCalls = [];
    if (idsToDelete.length > 0) {
      apiCalls.push(deleteRoundTrips({ body: idsToDelete }));
    }
    if (roundTripsIds.length > 0 || oneWaysIds.length > 0) {
      apiCalls.push(
        postRoundTrips({
          roundTrips: { round_trips: roundTripsIds, one_ways: oneWaysIds },
        })
      );
    }
    await Promise.all(apiCalls);

    await refreshNge();

    closeModal();
  };

  useModalFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (!pacedTrainRoundtrips || trainSchedulesWithOpsById.size === 0) return;

    const roundTripGroups = groupRoundTrips(trainSchedulesWithOpsById, pacedTrainRoundtrips);

    setPairingItems(formatPairingItems(roundTripGroups, t));
  }, [pacedTrainRoundtrips, trainSchedulesWithOpsById]);

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
          trainSchedulesWithOpsById={trainSchedulesWithOpsById}
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
