import { useMemo, useRef, useState } from 'react';

import {
  Clock,
  Flame,
  KebabHorizontal,
  Manchette,
  Moon,
  Pencil,
  Play,
  Reverse,
  Skip,
  Trash,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiPathDistance } from 'react-icons/gi';
import { useSelector } from 'react-redux';

import AnchoredMenu from 'common/AnchoredMenu';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import OSRDMenu, { type OSRDMenuItem } from 'common/OSRDMenu';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import type { InvalidReason, Occurrence } from 'modules/timetableItem/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { addElementAtIndex } from 'utils/array';
import { addDurationToDate } from 'utils/duration';
import {
  getExceptionType,
  isExceptionFromPathOrSimulation,
  isIndexedOccurrenceId,
} from 'utils/trainId';

import OccurrenceIndicator from './OccurrenceIndicator';
import ArrivalTimeLoader from '../ArrivalTimeLoader';
import { formatTrainDuration, isValidPathfinding, roundAndFormatToNearestMinute } from '../utils';
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
  subCategories?: SubCategory[];
  pacedTrainInvalidReason?: InvalidReason;
  pathUsedForProjectionIsException?: boolean;
};

const OccurrenceItem = ({
  occurrence,
  isSelected,
  nextOccurrence,
  occurrenceActions: {
    selectOccurrence,
    selectOccurrenceForProjection,
    editOccurrence,
    updateOccurrenceStatus,
    resetOccurrenceExceptions,
    deleteAddedException,
  },
  subCategories,
  pacedTrainInvalidReason,
  pathUsedForProjectionIsException,
}: OccurrenceItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const { trainName, rollingStock, startTime, disabled, exceptionChangeGroups, summary } =
    occurrence;

  let arrivalTime: Date | undefined;
  let isAfterMidnight = false;
  if (summary?.isValid) {
    arrivalTime = addDurationToDate(startTime, summary.duration);
    isAfterMidnight = dayjs(arrivalTime).isAfter(startTime, 'day');
  }
  const isNextAfterMidnight =
    !!nextOccurrence && dayjs(nextOccurrence.startTime).isAfter(startTime, 'day');
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
      dataTestID: 'occurrence-disable-button',
    },
    enable: {
      title: t('occurrenceMenu.enable'),
      icon: <Play />,
      onClick: () => {
        updateOccurrenceStatus(occurrence, 'enable');
        closeMenu();
      },
      dataTestID: 'occurrence-enable-button',
    },
    edit: {
      title: t('occurrenceMenu.edit'),
      icon: <Pencil />,
      onClick: () => {
        editOccurrence(occurrence);
        closeMenu();
      },
      dataTestID: 'occurrence-edit-button',
    },
    restore: {
      title: t('occurrenceMenu.restore'),
      icon: <Reverse />,
      onClick: () => {
        resetOccurrenceExceptions(occurrence.id);
        closeMenu();
      },
      dataTestID: 'occurrence-restore-button',
    },
    project: {
      title: t('occurrenceMenu.project'),
      icon: <GiPathDistance />,
      onClick: () => {
        selectOccurrenceForProjection(occurrence.id);
        closeMenu();
      },
      dataTestID: 'occurrence-project-button',
      disabled: !isValidPathfinding(summary),
    },
    delete: {
      title: t('occurrenceMenu.delete'),
      icon: <Trash />,
      onClick: () => {
        deleteAddedException(occurrence.id);
        closeMenu();
      },
      dataTestID: 'occurrence-delete-button',
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
      data-train-id={occurrence.id}
      className={cx('occurrence-item', {
        'after-midnight': isAfterMidnight,
        'next-after-midnight': isNextAfterMidnight,
        selected: isSelected,
        disabled,
        invalid: summary && !summary.isValid,
      })}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isMenuOpen || disabled) return;
        selectOccurrence(occurrence.id);
      }}
    >
      <div
        className={cx('main', {
          warning: !disabled && summary && (!summary.isValid || !!summary.notHonoredReason),
          'not-honored': !disabled && summary?.isValid && !!summary.notHonoredReason,
        })}
      >
        <div className="title-img">
          <div className="indicator-title">
            {trainIdUsedForProjection === occurrence.id && pathUsedForProjectionIsException && (
              <div className="occurrence-projected">
                <Manchette iconColor="var(--white100)" />
              </div>
            )}
            <OccurrenceIndicator occurrence={occurrence} subCategories={subCategories} />

            <div className="label">
              <div
                data-testid="occurrence-item-name"
                className={cx('occurrence-item-name', {
                  'start-time-exception': isStartTimeException,
                })}
              >
                <span title={trainName}>{trainName}</span>
              </div>
            </div>
          </div>
          <div className="rolling-stock">
            {rollingStock && <RollingStock2Img rollingStock={rollingStock} />}
          </div>
        </div>

        <div className="occurrence-item-horaries">
          <div className="status-icon after-midnight">
            {isAfterMidnight && <Moon iconColor="rgba(33, 100, 130, 0.7)" />}
          </div>
          <div className="occurrence-item-time departure-time" data-testid="departure-time">
            {roundAndFormatToNearestMinute(startTime)}
          </div>
          <div
            className={cx('status-icon', {
              'not-honored-or-too-fast': summary?.isValid && summary.notHonoredReason,
            })}
          >
            {!occurrence.disabled &&
              summary?.isValid &&
              summary.notHonoredReason &&
              (summary.notHonoredReason === 'scheduleNotHonored' ? <Clock /> : <Flame />)}
          </div>
          <div className="occurrence-item-time arrival-time" data-testid="arrival-time">
            {arrivalTime && roundAndFormatToNearestMinute(arrivalTime)}
            {!summary && <ArrivalTimeLoader />}
          </div>
        </div>

        {nextOccurrence && isNextAfterMidnight && (
          <ConsecutiveDayDateDisplay
            departureTime={startTime}
            nextDepartureTime={nextOccurrence?.startTime}
          />
        )}
      </div>

      {summary && !summary.isValid && summary.invalidReason !== pacedTrainInvalidReason && (
        <div className="invalid-reason">
          <span title={t(`timetable.invalid.${summary.invalidReason}`)}>
            {t(`timetable.invalid.${summary.invalidReason}`)}
          </span>
        </div>
      )}

      {summary?.isValid && !disabled && isExceptionFromPathOrSimulation(occurrence) && (
        <div className="more-info">
          <div className="more-info-left">
            {/* TODO : add a category span in https://github.com/OpenRailAssociation/osrd/issues/11542 */}
            <span className="more-info-item">
              {t('timetable.stopsCount', { count: occurrence.stopsCount })}
            </span>
            <span className="more-info-item">{summary.pathLength}</span>
            <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
              {summary.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          <div className="duration-time">
            <span data-testid="train-duration">{formatTrainDuration(summary.duration)}</span>
          </div>
        </div>
      )}
      <button
        ref={menuButtonRef}
        type="button"
        data-testid="occurrence-item-menu-btn"
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
