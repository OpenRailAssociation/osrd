import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { checkRoundTripCompatible } from 'applications/operationalStudies/utils';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import type { TimetableItemId, TimetableItemWithPathOps } from 'reducers/osrdconf/types';
import { isPacedTrainId } from 'utils/trainId';

import RoundTripsModalCard from './RoundTripsModalCard';
import RoundTripsModalPairingColumn from './RoundTripsModalPairingColumn';
import type { PairingItem } from './types';

type TodoColumnProps = {
  setPairingItems: React.Dispatch<React.SetStateAction<PairingItem[]>>;
  pairingItems: PairingItem[];
  itemIdToPair?: TimetableItemId;
  setItemIdToPair: (itemToPair?: TimetableItemId) => void;
  timetableItemsWithOpsById: Map<TimetableItemId, TimetableItemWithPathOps>;
  pairingItemsById: Map<TimetableItemId, PairingItem>;
  subCategories: SubCategory[];
};

const PAIRING_ITEM_OUTLINE_WIDTH = 4;
const ROUNDING_BLOCK_HEIGHT = 20; // Height of the pseudo-element for rounding effect

const TodoColumn = ({
  setPairingItems,
  pairingItems,
  itemIdToPair,
  setItemIdToPair,
  timetableItemsWithOpsById,
  pairingItemsById,
  subCategories,
}: TodoColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const columnWrapperRef = useRef<HTMLDivElement>(null);
  const [pairingIndicatorTop, setPairingIndicatorTop] = useState<number>();

  const pairingCandidates = useMemo(() => {
    if (!itemIdToPair) return undefined;

    const suggestions: PairingItem[] = [];
    const others: PairingItem[] = [];
    const timetableItemToPair = timetableItemsWithOpsById.get(itemIdToPair)!;

    for (const candidate of timetableItemsWithOpsById.values()) {
      if (
        candidate.id === itemIdToPair ||
        isPacedTrainId(candidate.id) !== isPacedTrainId(itemIdToPair)
      )
        continue;

      const matchingPairingItem = pairingItemsById.get(candidate.id)!;

      if (checkRoundTripCompatible(timetableItemToPair, candidate)) {
        suggestions.push(matchingPairingItem);
      } else {
        others.push(matchingPairingItem);
      }
    }

    return {
      suggestions: suggestions.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      ),
      others: others.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    };
  }, [timetableItemsWithOpsById, pairingItemsById, itemIdToPair]);

  const moveItemToOneWays = (itemToMove: PairingItem) => {
    setPairingItems((prevData) => [
      { ...itemToMove, status: 'oneWays' },
      ...prevData.filter((item) => itemToMove.id !== item.id),
    ]);
  };

  const openPairingMode = (itemId: TimetableItemId) => {
    setItemIdToPair(itemId);
  };

  const pairItems = (itemB: PairingItem) => {
    if (!itemIdToPair) return;
    // This item is always in todo
    const itemA = pairingItemsById.get(itemIdToPair);
    const timetableItemA = timetableItemsWithOpsById.get(itemIdToPair);
    const timetableItemB = timetableItemsWithOpsById.get(itemB.id);

    if (!itemA || !timetableItemA || !timetableItemB) {
      throw new Error('Item to pair not found in todo column');
    }

    const isValidPair = checkRoundTripCompatible(timetableItemA, timetableItemB);

    setPairingItems((prevData) => {
      // If the candidate item is already paired, we need to move its old pair to todo column
      let orphanItem: PairingItem | undefined;

      if (itemB.status === 'roundTrips') {
        const orphanPairingItem = pairingItemsById.get(itemB.pairedItemId)!;
        if (!orphanPairingItem || orphanPairingItem.status !== 'roundTrips')
          throw new Error('Orphan pairing item not found or wrong status');
        const { pairedItemId: _, isValidPair: __, ...orphanItemProps } = orphanPairingItem;
        orphanItem = { ...orphanItemProps, status: 'todo' };
      }

      const updatedPairingItems: PairingItem[] = [
        {
          ...itemA,
          status: 'roundTrips',
          pairedItemId: itemB.id,
          isValidPair,
        },
        {
          ...itemB,
          status: 'roundTrips',
          pairedItemId: itemIdToPair,
          isValidPair,
        },
        ...prevData.filter(
          (item) => item.id !== orphanItem?.id && item.id !== itemA.id && item.id !== itemB.id
        ),
      ];

      return orphanItem ? [orphanItem, ...updatedPairingItems] : updatedPairingItems;
    });

    setItemIdToPair(undefined);
  };

  // Logic to check if the pairing item is the first visible item of the column
  // and display a round effect above the pairing item to visually connect it
  // with the pairing column
  useLayoutEffect(() => {
    const checkFirstVisibleItem = () => {
      if (!columnWrapperRef.current || !itemIdToPair) {
        setPairingIndicatorTop(undefined);
        return;
      }

      const columnWrapper = columnWrapperRef.current;
      const pairingCards = columnWrapper.querySelectorAll('.pairing-item-wrapper');
      if (pairingCards.length === 0) {
        setPairingIndicatorTop(undefined);
        return;
      }

      const firstPairingCard = pairingCards[0] as HTMLElement;
      const columnWrapperRect = columnWrapper.getBoundingClientRect();
      const cardRect = firstPairingCard.getBoundingClientRect();

      // Get the top position of the card with outline included
      const cardTopWithOutline = cardRect.top - PAIRING_ITEM_OUTLINE_WIDTH;

      const isCompletelyVisible = cardTopWithOutline >= columnWrapperRect.top;

      if (isCompletelyVisible) {
        // Put the pseudo-element above the outline
        setPairingIndicatorTop(cardTopWithOutline - columnWrapperRect.top - ROUNDING_BLOCK_HEIGHT);
      } else if (cardTopWithOutline < columnWrapperRect.top) {
        // Put the pseudo-element above the wrapper
        setPairingIndicatorTop(-ROUNDING_BLOCK_HEIGHT);
      } else {
        // Hide the pseudo-element if the card is not visible
        setPairingIndicatorTop(undefined);
      }
    };

    checkFirstVisibleItem();

    const columnWrapper = columnWrapperRef.current;
    if (columnWrapper) {
      columnWrapper.addEventListener('scroll', checkFirstVisibleItem);
      return () => columnWrapper.removeEventListener('scroll', checkFirstVisibleItem);
    }

    return undefined;
  }, [itemIdToPair]);

  return (
    <section
      ref={columnWrapperRef}
      className={cx('round-trips-modal-column-wrapper', {
        'show-pairing-indicator': pairingIndicatorTop !== undefined,
      })}
    >
      {pairingIndicatorTop !== undefined && (
        <div className="before-rounding-block" style={{ top: pairingIndicatorTop }} />
      )}
      <div className="scroll-container">
        <div data-testid="todo-column" className="round-trips-modal-column">
          <h2 className="column-title">
            <span data-testid="todo-title">{t('todo')}</span>
            <div data-testid="todo-item-count" className="item-count">
              {pairingItems.length}
            </div>
          </h2>
          <div className="column-wrapper">
            {pairingItems.length === 0 ? (
              <div className="card-placeholder" />
            ) : (
              pairingItems.map((pairingItem) => (
                <div
                  className={cx('round-trips-card-wrapper', {
                    'pairing-item-wrapper': itemIdToPair === pairingItem.id,
                  })}
                  key={pairingItem.id}
                >
                  <RoundTripsModalCard
                    pairingItem={pairingItem}
                    isItemToPair={itemIdToPair === pairingItem.id}
                    moveItemToOneWays={moveItemToOneWays}
                    openPairingMode={openPairingMode}
                    subCategories={subCategories}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {itemIdToPair && pairingCandidates && (
        <RoundTripsModalPairingColumn
          closePairingMode={() => {
            setItemIdToPair(undefined);
            setPairingIndicatorTop(undefined);
          }}
          suggestions={pairingCandidates.suggestions}
          others={pairingCandidates.others}
          pairItems={pairItems}
          pairingItemsById={pairingItemsById}
          subCategories={subCategories}
        />
      )}
    </section>
  );
};

export default TodoColumn;
