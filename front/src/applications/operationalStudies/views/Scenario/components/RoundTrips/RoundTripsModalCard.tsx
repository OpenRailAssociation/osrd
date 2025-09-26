import { useMemo, useRef, useState } from 'react';

import { ArrowRight, ArrowSwitch, KebabHorizontal, Services, Square } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { BsXCircleFill } from 'react-icons/bs';

import AnchoredMenu from 'common/AnchoredMenu';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';
import OSRDTooltip from 'common/OSRDTooltip';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { TimetableItemId } from 'reducers/osrdconf/types';

import type { PairDataToolTip, PairingItem } from './types';
import { getTrainCategoryClassName } from '../Timetable/utils';

type RoundTripsModalCardProps = {
  pairingItem: PairingItem;
  isItemToPair?: boolean;
  restoreItems?: () => void;
  moveItemToOneWays?: (item: PairingItem) => void;
  openPairingMode?: (itemId: TimetableItemId) => void | undefined;
  isCandidate?: boolean;
  pairData?: PairDataToolTip;
  subCategories: SubCategory[];
};

const RoundTripsModalCard = ({
  pairingItem,
  isItemToPair,
  restoreItems,
  moveItemToOneWays,
  openPairingMode,
  isCandidate,
  pairData,
  subCategories,
}: RoundTripsModalCardProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const stopsRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStopsTooltipOpen, setIsStopsTooltipOpen] = useState(false);
  const [isStatusTooltipOpen, setIsStatusTooltipOpen] = useState(false);

  const {
    id,
    name,
    category,
    interval,
    origin,
    stops,
    destination,
    startTime,
    requestedArrivalTime,
    status,
  } = pairingItem;

  const getStatusIcon = (itemStatus: 'todo' | 'oneWays' | 'roundTrips') => {
    if (itemStatus === 'todo') {
      return <Square />;
    }
    if (itemStatus === 'oneWays') {
      return <ArrowRight />;
    }
    return <ArrowSwitch />;
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const statusTooltipBody = (
    pair: Pick<
      PairingItem,
      'name' | 'origin' | 'startTime' | 'destination' | 'requestedArrivalTime'
    >
  ) => [
    pair.name,
    `${pair.startTime.getMinutes().toString().padStart(2, '0')} | ${pair.origin}`,
    `${pair.requestedArrivalTime ? pair.requestedArrivalTime.getMinutes().toString().padStart(2, '0') : '\u00A0\u00A0\u00A0?'} | ${pair.destination}`,
  ];

  const menuItems: Record<string, OSRDMenuItem> = {
    restore: {
      dataTestID: 'round-trips-restore-menu-item',
      title: t('restore'),
      icon: <BsXCircleFill />,
      onClick: () => {
        restoreItems?.();
        closeMenu();
      },
    },
    setOneWay: {
      dataTestID: 'round-trips-set-one-way-menu-item',
      title: t('setOneWay'),
      icon: <ArrowRight />,
      onClick: () => {
        moveItemToOneWays?.(pairingItem);
        closeMenu();
      },
    },
    pickReturn: {
      dataTestID: 'round-trips-pick-return-menu-item',
      title: t('pickReturn'),
      icon: <ArrowSwitch />,
      onClick: () => {
        openPairingMode?.(id);
        closeMenu();
      },
    },
  };

  const filteredMenuItems = useMemo(() => {
    const { restore, setOneWay, pickReturn } = menuItems;

    if (status === 'todo') {
      return [setOneWay, pickReturn];
    }

    return [restore];
  }, [menuItems, status]);

  const menu = AnchoredMenu({
    children: isMenuOpen && (
      <OSRDMenu menuRef={menuRef} items={filteredMenuItems} className="round-trips-menu" />
    ),
    anchorRef: menuButtonRef,
    onDismiss: closeMenu,
    container: document.querySelector('.round-trips-modal'),
  });

  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;

  return (
    <div
      data-testid="round-trips-card"
      className={cx('round-trips-card', {
        'pairing-item': isItemToPair,
      })}
    >
      <div className="round-trips-card-header">
        <h3
          data-testid="round-trips-card-name"
          title={name}
          className={cx('name', getTrainCategoryClassName(category, 'text'))}
          style={{ color: currentSubCategory?.color }}
        >
          {name}
        </h3>
        <div data-testid="round-trips-card-interval" className="interval" title={t('cadence')}>
          {interval ? `${interval.total('minute')}\u2019` : '\u2013'}
        </div>
        <div
          ref={statusRef}
          className="status"
          onMouseEnter={() => setIsStatusTooltipOpen(true)}
          onMouseLeave={() => setIsStatusTooltipOpen(false)}
        >
          {getStatusIcon(status)}
        </div>
        {isStatusTooltipOpen && status === 'roundTrips' && pairData && (
          <OSRDTooltip
            containerRef={statusRef}
            header={t('matchedWith')}
            items={statusTooltipBody(pairData)}
            offsetRatio={{ top: 1.2, left: 0.22 }} // ratio computed based on container size and tooltip offset
            reverseIfOverflow
          />
        )}
        <button
          ref={menuButtonRef}
          type="button"
          data-testid="round-trips-card-menu-button"
          className="card-menu"
          title={t('openRoundTripsMenu')}
          disabled={isCandidate}
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(true);
          }}
        >
          <KebabHorizontal />
        </button>
        {menu}
      </div>
      <div className="round-trips-card-body">
        <div
          ref={stopsRef}
          className="stops"
          onMouseEnter={() => setIsStopsTooltipOpen(true)}
          onMouseLeave={() => setIsStopsTooltipOpen(false)}
        >
          <span
            data-testid="round-trips-card-stops"
            className={cx({ 'no-stops': stops.length === 0 })}
          >
            {stops.length}
          </span>
          <Services className="stops-icon" />
        </div>
        {isStopsTooltipOpen && stops.length > 0 && (
          <OSRDTooltip
            containerRef={stopsRef}
            header={t('intermediateStops')}
            items={stops}
            offsetRatio={{ top: 1.2, left: 0.22 }} // ratio computed based on container size and tooltip offset
            reverseIfOverflow
          />
        )}
        <div className="od-infos">
          <div className="extremity">
            <div data-testid="round-trips-card-start-time" className="times">
              {startTime.getMinutes().toString().padStart(2, '0')}
            </div>
            <div data-testid="round-trips-card-origin" className="location">
              {origin}
            </div>
          </div>
          <div className="extremity">
            <div data-testid="round-trips-card-requested-arrival-time" className="times">
              {requestedArrivalTime
                ? requestedArrivalTime.getMinutes().toString().padStart(2, '0')
                : '?'}
            </div>
            <div data-testid="round-trips-card-destination" className="location">
              {destination}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundTripsModalCard;
