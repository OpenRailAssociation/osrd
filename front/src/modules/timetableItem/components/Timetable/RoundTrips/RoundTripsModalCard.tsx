import { useMemo, useRef, useState } from 'react';

import { ArrowRight, ArrowSwitch, KebabHorizontal, Services, Square } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { BsXCircleFill } from 'react-icons/bs';

import AnchoredMenu from 'common/AnchoredMenu';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';
import isMainCategory from 'modules/rollingStock/helpers/category';

import { TRAIN_MAIN_CATEGORY_CLASS } from '../consts';
import type { PairingItem } from '../types';

type RoundTripsModalCardProps = {
  pairingItem: PairingItem;
  status: 'todo' | 'oneWays' | 'roundTrips';
  restoreItems: () => void;
  moveItemToOneWays?: (item: PairingItem) => void;
  subCategories: SubCategory[];
};

const RoundTripsModalCard = ({
  pairingItem,
  status,
  restoreItems,
  moveItemToOneWays,
  subCategories,
}: RoundTripsModalCardProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { name, category, interval, origin, stops, destination, startTime, requestedArrivalTime } =
    pairingItem;

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

  // TODO : add actions for each menu item
  const menuItems: Record<string, OSRDMenuItem> = {
    restore: {
      title: t('restore'),
      icon: <BsXCircleFill />,
      onClick: () => {
        restoreItems();
        closeMenu();
      },
    },
    setOneWay: {
      title: t('setOneWay'),
      icon: <ArrowRight />,
      onClick: () => {
        moveItemToOneWays?.(pairingItem);
        closeMenu();
      },
    },
    pickReturn: {
      title: t('pickReturn'),
      icon: <ArrowSwitch />,
      onClick: () => {
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
    <div className="round-trips-card">
      <div className="round-trips-card-header">
        <h3
          className={cx(
            'name',
            `train-category-text-${TRAIN_MAIN_CATEGORY_CLASS[category && isMainCategory(category) ? category.main_category : 'None']}`
          )}
          style={{ color: currentSubCategory?.color }}
        >
          {name}
        </h3>
        <div className="interval" title={t('cadence')}>
          {interval ? `${interval.total('minute')}\u2019` : '\u2013'}
        </div>
        <div className="status">{getStatusIcon(status)}</div>
        <button
          ref={menuButtonRef}
          type="button"
          className="card-menu"
          title={t('openRoundTripsMenu')}
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
        <div className="stops">
          <span className={cx({ 'no-stops': stops.length === 0 })}>{stops.length}</span>
          <Services className="stops-icon" />
        </div>
        <div className="od-infos">
          <div className="extremity">
            <div className="times">{startTime.getMinutes().toString().padStart(2, '0')}</div>
            <div className="location">{origin}</div>
          </div>
          <div className="extremity">
            <div className="times">
              {requestedArrivalTime
                ? requestedArrivalTime.getMinutes().toString().padStart(2, '0')
                : '?'}
            </div>
            <div className="location">{destination}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundTripsModalCard;
