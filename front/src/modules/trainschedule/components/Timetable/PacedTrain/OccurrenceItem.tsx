import { useMemo, useRef, useState } from 'react';

import { KebabHorizontal, Moon, Pencil, Play, Reverse, Skip, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiPathDistance } from 'react-icons/gi';

import AnchoredMenu from 'common/AnchoredMenu';
import OSRDMenu, { type OSRDMenuItem } from 'common/OSRDMenu';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { addElementAtIndex } from 'utils/array';
import {
  getExceptionType,
  isExceptionFromPathOrSimulation,
  isIndexedOccurrenceId,
} from 'utils/trainId';

import OccurrenceIndicator from './OccurrenceIndicator';
import ArrivalTimeLoader from '../ArrivalTimeLoader';
import type { Occurrence } from '../types';
import { formatTrainDuration, roundAndFormatToNearestMinute } from '../utils';
import type useOccurrenceActions from './hooks/useOccurrenceActions';

const ConsecutiveDayDateDisplay = ({
  departureTime,
  nextDepartureTime,
}: {
  departureTime: Date;
  nextDepartureTime: Date;
}) => (
  <div className="consecutive-day-display">
    <div>
      <div className="date-display before-midnight">{dayjs(departureTime).format('DD')}</div>
      <div className="date-display after-midnight">{dayjs(nextDepartureTime).format('DD')}</div>
    </div>
    <div className="date-display">/{dayjs(nextDepartureTime).format('MM')}</div>
  </div>
);

type OccurrenceItemProps = {
  occurrence: Occurrence;
  isSelected: boolean;
  nextOccurrence?: Occurrence;
  occurrenceActions: ReturnType<typeof useOccurrenceActions>;
};

const OccurrenceItem = ({
  occurrence,
  isSelected,
  nextOccurrence,
  occurrenceActions: {
    selectOccurrence,
    editOccurrence,
    updateOccurrenceStatus,
    resetOccurrenceExceptions,
    deleteAddedException,
  },
}: OccurrenceItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { trainName, rollingStock, startTime, disabled, exceptionChangeGroups, isValid } =
    occurrence;

  const isAfterMidnight = isValid && dayjs(occurrence.arrivalTime).isAfter(startTime, 'day');
  const isNextAfterMidnight = nextOccurrence
    ? dayjs(nextOccurrence.startTime).isAfter(startTime, 'day')
    : false;
  const isStartTimeException = !!exceptionChangeGroups?.start_time?.value;

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // TODO exceptions : add action to menu buttons
  const menuItems: Record<string, OSRDMenuItem> = {
    disable: {
      title: t('occurrenceMenu.disable'),
      icon: <Skip />,
      onClick: () => {
        updateOccurrenceStatus(occurrence, 'disabled');
        closeMenu();
      },
    },
    enable: {
      title: t('occurrenceMenu.enable'),
      icon: <Play />,
      onClick: () => {
        updateOccurrenceStatus(occurrence, 'enable');
        closeMenu();
      },
    },
    edit: {
      title: t('occurrenceMenu.edit'),
      icon: <Pencil />,
      onClick: () => {
        editOccurrence(occurrence);
        closeMenu();
      },
    },
    restore: {
      title: t('occurrenceMenu.restore'),
      icon: <Reverse />,
      onClick: () => {
        resetOccurrenceExceptions(occurrence.id);
        closeMenu();
      },
    },
    project: {
      title: t('occurrenceMenu.project'),
      icon: <GiPathDistance />,
      onClick: () => {
        closeMenu();
      },
    },
    delete: {
      title: t('occurrenceMenu.delete'),
      icon: <Trash />,
      onClick: () => {
        deleteAddedException(occurrence.id);
        closeMenu();
      },
    },
  };

  // TODO exceptions : filter menu items depending on the occurrence status
  const filteredMenuItems = useMemo(() => {
    const { disable, enable, delete: deleteItem, edit, restore, project } = menuItems;

    if (disabled) {
      return [enable];
    }
    const items = [getExceptionType(occurrence) === 'added' ? deleteItem : disable, edit, project];

    if (
      exceptionChangeGroups &&
      (Object.keys(
        isIndexedOccurrenceId(occurrence.id)
          ? exceptionChangeGroups
          : omit(exceptionChangeGroups, 'start_time')
      ).length ?? 0) > 0
    ) {
      return addElementAtIndex(items, 2, restore);
    }
    return items;
  }, [menuItems, exceptionChangeGroups]);

  const occurrenceMenu = AnchoredMenu({
    children: isMenuOpen && (
      <OSRDMenu menuRef={menuRef} items={filteredMenuItems} className="occurrence-menu" />
    ),
    anchorRef: menuButtonRef,
    onDismiss: closeMenu,
  });

  return (
    <div
      data-testid="occurrence-item"
      className={cx('occurrence-item', {
        'after-midnight': isAfterMidnight,
        'next-after-midnight': isNextAfterMidnight,
        selected: isSelected,
        disabled,
      })}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isMenuOpen || disabled) return;
        // TODO exceptions : adapt this in issue https://github.com/OpenRailAssociation/osrd/issues/11476
        if (getExceptionType(occurrence) !== 'added') selectOccurrence(occurrence.id);
      }}
    >
      <div className="main">
        <OccurrenceIndicator occurrence={occurrence} />
        <div
          className={cx('occurrence-item-name', { 'start-time-exception': isStartTimeException })}
        >
          <span title={trainName}>{trainName}</span>
        </div>
        <div className="rolling-stock">
          {rollingStock && <RollingStock2Img rollingStock={rollingStock} />}
        </div>

        <div className="occurrence-item-horaries">
          <div className="status-icon after-midnight">
            {isAfterMidnight && <Moon iconColor="rgba(33, 100, 130, 0.7)" />}
          </div>
          <div className="occurrence-item-time departure-time">
            {roundAndFormatToNearestMinute(startTime)}
          </div>
          <div className="occurrence-item-time arrival-time">
            {occurrence.isValid && roundAndFormatToNearestMinute(occurrence.arrivalTime)}
            {!occurrence.isValid && !occurrence.invalidReason && <ArrivalTimeLoader />}
          </div>
        </div>

        {nextOccurrence && isNextAfterMidnight && (
          <ConsecutiveDayDateDisplay
            departureTime={startTime}
            nextDepartureTime={nextOccurrence?.startTime}
          />
        )}
      </div>

      {occurrence.isValid && !disabled && isExceptionFromPathOrSimulation(occurrence) && (
        <div className="more-info">
          <div className="more-info-left">
            {/* TODO : add a category span in https://github.com/OpenRailAssociation/osrd/issues/11542 */}
            <span className="more-info-item">
              {t('timetable.stopsCount', { count: occurrence.stopsCount })}
            </span>
            <span className="more-info-item">{occurrence.pathLength}</span>
            <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
              {occurrence.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          {occurrence.duration && (
            <div className="duration-time">
              <span data-testid="train-duration">{formatTrainDuration(occurrence.duration)}</span>
            </div>
          )}
        </div>
      )}
      <button
        ref={menuButtonRef}
        type="button"
        className={cx('occurrence-item-menu-btn', {
          'show-menu': isMenuOpen,
        })}
        title={t('occurrenceMenu.occurrenceMenuButton')}
        onClick={(e) => {
          e.stopPropagation();
          setIsMenuOpen(true);
        }}
      >
        <KebabHorizontal />
      </button>
      {occurrenceMenu}
    </div>
  );
};

export default OccurrenceItem;
