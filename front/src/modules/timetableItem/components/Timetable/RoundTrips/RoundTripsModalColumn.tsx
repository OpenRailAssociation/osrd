import { ArrowRight, ArrowSwitch } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { PairingItem, RoundTripsModalColumnsData } from '../types';
import RoundTripsModalCard from './RoundTripsModalCard';

type RoundTripsModalColumnProps = {
  setColumnData: React.Dispatch<React.SetStateAction<RoundTripsModalColumnsData>>;
} & (
  | {
      type: 'todo' | 'oneWays';
      pairingItems: PairingItem[];
    }
  | {
      type: 'roundTrips';
      pairingItems: { pair: [PairingItem, PairingItem]; isValid: boolean }[];
    }
);

const RoundTripsModalColumn = ({
  setColumnData,
  type,
  pairingItems,
}: RoundTripsModalColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const restoreItems = (itemsToMove: [PairingItem] | [PairingItem, PairingItem]) => {
    setColumnData((prevData) => ({
      // TODO : handle restore for items in round trips column in issue https://github.com/OpenRailAssociation/osrd/issues/12374
      ...prevData,
      todo: [...itemsToMove, ...prevData.todo],
      oneWays: prevData.oneWays.filter(
        (item) => !itemsToMove.some((moved) => moved.id === item.id)
      ),
    }));
  };

  const moveItemToOneWays = (itemToMove: PairingItem) => {
    setColumnData((prevData) => ({
      ...prevData,
      todo: prevData.todo.filter((item) => item.id !== itemToMove.id),
      oneWays: [itemToMove, ...prevData.oneWays],
    }));
  };

  return (
    <section
      className={cx('round-trips-modal-column', {
        'round-trips-column': type === 'roundTrips',
      })}
    >
      <h2 className="column-title">
        {type === 'oneWays' && <ArrowRight />}
        {type === 'roundTrips' && <ArrowSwitch />}
        <span>{t(type)}</span>
        <div className="item-count">{pairingItems.length}</div>
      </h2>
      <div className="column-wrapper">
        {type !== 'roundTrips' &&
          (pairingItems.length === 0 ? (
            <div className="card-placeholder" />
          ) : (
            pairingItems.map((pairingItem) => (
              <RoundTripsModalCard
                key={pairingItem.id}
                pairingItem={pairingItem}
                status={type}
                restoreItems={() => restoreItems([pairingItem])}
                moveItemToOneWays={moveItemToOneWays}
              />
            ))
          ))}
        {type === 'roundTrips' &&
          (pairingItems.length === 0 ? (
            <div className="round-trip-pair">
              <div className="card-placeholder" />
              <div className="separator" />
              <div className="card-placeholder" />
            </div>
          ) : (
            pairingItems.map(({ pair, isValid }) => (
              <div className="round-trip-pair" key={`${pair[0].id}-${pair[1].id}`}>
                <RoundTripsModalCard
                  pairingItem={pair[0]}
                  status={type}
                  restoreItems={() => restoreItems(pair)}
                />
                <div
                  className={cx('separator', {
                    valid: isValid,
                    invalid: !isValid,
                  })}
                />
                <RoundTripsModalCard
                  pairingItem={pair[1]}
                  status={type}
                  restoreItems={() => restoreItems(pair)}
                />
              </div>
            ))
          ))}
      </div>
    </section>
  );
};

export default RoundTripsModalColumn;
