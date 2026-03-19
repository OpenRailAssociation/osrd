import { useCallback, Fragment, useMemo, useRef } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Moon } from '@osrd-project/ui-icons';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
  type RowData,
} from '@tanstack/react-table';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { ReceptionSignal } from 'common/api/osrdEditoastApi';
import { formatLocalTime, useDateTimeLocale } from 'utils/date';
import { calculateTimeDifferenceInDays } from 'utils/timeManipulation';

import DurationCell, { type DurationCellHandle } from './DurationCell';
import { onStopSignalToReceptionSignal } from './helpers/utils';
import MarginCell from './MarginCell';
import TimeCell, { type TimeCellHandle } from './TimeCell';
import type { MarginValue, PropagationMode, TimesStopsRowNew } from './types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className: string;
    tabbable?: boolean;
    title?: string;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    allRows: TimesStopsRowNew[];
    isComputedDataPending?: boolean;
    onArrivalChange: (
      row: TimesStopsRowNew,
      arrival: Date | null,
      propagationMode: PropagationMode
    ) => void;
    onStopDurationChange: (row: TimesStopsRowNew, durationSeconds: number | null) => void;
    onDepartureChange: (
      row: TimesStopsRowNew,
      departure: Date | null,
      propagationMode: PropagationMode
    ) => void;
    onReceptionSignalChange: (row: TimesStopsRowNew, signal: ReceptionSignal | undefined) => void;
    onRequestedMarginChange: (row: TimesStopsRowNew, requestedMargin: MarginValue | null) => void;
  }
}

/**
 * Get the reference date for arrival editing.
 * Uses the previous row's latest time (departure > arrival) to determine the correct day.
 */
const getArrivalReferenceDate = (
  row: TimesStopsRowNew,
  allRows: TimesStopsRowNew[],
  startTime: Date
): Date => {
  // Find the previous row with any time information
  const previousRow = allRows.findLast(
    (r) =>
      r.opOnPathIndex < row.opOnPathIndex &&
      (r.computedDeparture || r.computedArrival || r.requestedDeparture || r.requestedArrival)
  );

  if (!previousRow) return startTime;

  // Use the latest available time from the previous row
  return (
    previousRow.computedDeparture ??
    previousRow.computedArrival ??
    previousRow.requestedDeparture ??
    previousRow.requestedArrival ??
    startTime
  );
};

/**
 * Get the reference date for departure editing.
 * Uses the current row's arrival time since departure must be after arrival.
 */
const getDepartureReferenceDate = (row: TimesStopsRowNew, startTime: Date): Date =>
  row.computedArrival ?? row.requestedArrival ?? startTime;

type TimesStopsTableProps = {
  rows: TimesStopsRowNew[];
  startTime: Date;
  isValid: boolean;
  isComputedDataPending?: boolean;
  onArrivalChange: (
    row: TimesStopsRowNew,
    arrival: Date | null,
    propagationMode: PropagationMode
  ) => void;
  onStopDurationChange: (row: TimesStopsRowNew, durationSeconds: number | null) => void;
  onDepartureChange: (
    row: TimesStopsRowNew,
    departure: Date | null,
    propagationMode: PropagationMode
  ) => void;
  onReceptionSignalChange: (row: TimesStopsRowNew, signal: ReceptionSignal | undefined) => void;
  onRequestedMarginChange: (row: TimesStopsRowNew, value: MarginValue | null) => void;
};

const columnHelper = createColumnHelper<TimesStopsRowNew>();
const getTimeCellKey = (rowIndex: number, columnId: string) => `${rowIndex}-${columnId}`;
type TabbableCellColumnId = 'requestedArrival' | 'stopDuration' | 'requestedDeparture';
type TabbableCellHandle = TimeCellHandle | DurationCellHandle;
type TimeCellTabEntry = {
  next: string | null;
  prev: string | null;
};

const TimesStopsTable = ({
  rows,
  startTime,
  isValid,
  isComputedDataPending,
  onArrivalChange,
  onStopDurationChange,
  onDepartureChange,
  onReceptionSignalChange,
  onRequestedMarginChange,
}: TimesStopsTableProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable' });
  const dateTimeLocale = useDateTimeLocale();
  const scheduleNotHonored = rows.some((row) => row.stepStatus === 'scheduleNotHonored');
  const cellHandlesRef = useRef<Map<string, TabbableCellHandle>>(new Map());
  const cellTabOrderRef = useRef<Map<string, TimeCellTabEntry>>(new Map());

  const registerTimeCellRef = useCallback(
    (rowIndex: number, columnId: string) => (handle: TabbableCellHandle | null) => {
      const key = getTimeCellKey(rowIndex, columnId);
      if (handle) {
        cellHandlesRef.current.set(key, handle);
      } else {
        cellHandlesRef.current.delete(key);
      }
    },
    []
  );

  const focusCellBelow = useCallback(
    (rowIndex: number, columnId: string) => {
      const targetRowIndex = rowIndex + 1;
      if (targetRowIndex >= rows.length) return;
      const key = getTimeCellKey(targetRowIndex, columnId);
      cellHandlesRef.current.get(key)?.focus();
    },
    [rows.length]
  );

  const focusRequestedCellOnTab = useCallback(
    (rowIndex: number, columnId: TabbableCellColumnId, direction: 'forward' | 'backward') => {
      const currentKey = getTimeCellKey(rowIndex, columnId);
      const entry = cellTabOrderRef.current.get(currentKey);
      if (!entry) return false;
      const key = direction === 'forward' ? entry.next : entry.prev;
      if (!key) return false;

      cellHandlesRef.current.get(key)?.focus();
      return true;
    },
    []
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'opOnPathIndex',
        header: '',
        cell: (info) => <span>{info.row.original.opOnPathIndex + 1}</span>,
        meta: {
          className: 'col-index computed',
        },
      }),
      columnHelper.display({
        id: 'stepStatus',
        header: '',
        cell: (info) => {
          if (info.table.options.meta!.isComputedDataPending) {
            return <span>&nbsp;</span>;
          }

          const { stepStatus, computedArrival, requestedArrival, isPathStep } = info.row.original;

          const isSuccessSchedule =
            requestedArrival &&
            computedArrival &&
            !(stepStatus === 'marginNotHonored') &&
            !(stepStatus === 'scheduleNotHonored');

          const className = cx({
            'success-schedule': isPathStep && isSuccessSchedule,
            'warning-schedule': isPathStep && stepStatus === 'scheduleNotHonored',
            'warning-margin': isPathStep && stepStatus === 'marginNotHonored',
            'invalid-path-step': stepStatus === 'invalidPathStep',
          });

          return <span className={className}>&nbsp;</span>;
        },
        meta: {
          className: 'col-step-status computed',
        },
      }),
      columnHelper.accessor('name', {
        header: () => t('operational_point'),
        cell: (info) => {
          const { name, secondaryCode, isPathStep } = info.row.original;
          return (
            <>
              {isPathStep && <span className="requested-point-dot" />}
              <div title={`${name}${secondaryCode ? ` ${secondaryCode}` : ''}`}>
                <span>{name}</span>
                {secondaryCode && <span className="secondary-code"> {secondaryCode}</span>}
              </div>
            </>
          );
        },
        meta: {
          className: 'col-name computed',
          title: t('operational_point'),
        },
      }),
      columnHelper.accessor('track', {
        header: () => t('trackName'),
        cell: (info) => {
          const { isPathStep, hasRequestedTrack } = info.row.original;
          return (
            <>
              {isPathStep && hasRequestedTrack && <span className="requested-point-dot" />}
              <span>{info.getValue() ?? ''}</span>
            </>
          );
        },
        meta: {
          className: 'col-track computed',
          title: t('trackName'),
        },
      }),
      columnHelper.accessor('requestedArrival', {
        header: () => t('arrivalTime'),
        cell: (info) => {
          const row = info.row.original;
          const { allRows, onArrivalChange: onArrival } = info.table.options.meta!;
          return (
            <TimeCell
              ref={registerTimeCellRef(info.row.index, 'requestedArrival')}
              {...info}
              referenceDate={getArrivalReferenceDate(row, allRows, startTime)}
              prefillValue={row.computedArrival}
              onEnterKeyDown={() => focusCellBelow(info.row.index, 'requestedArrival')}
              onTabKeyDown={(direction) =>
                focusRequestedCellOnTab(info.row.index, 'requestedArrival', direction)
              }
              onCommit={(date, propagationMode) => onArrival(row, date, propagationMode)}
              disableClear={info.row.index === 0}
            />
          );
        },
        meta: {
          className: 'col-requested-arrival',
          tabbable: true,
          title: t('arrivalTime'),
        },
      }),
      columnHelper.accessor('computedArrival', {
        header: () => t('calculatedArrivalTime'),
        cell: (info) => {
          if (info.table.options.meta!.isComputedDataPending) {
            return <span className="cell-loading-placeholder" />;
          }
          const value = info.getValue();
          return <span>{value ? formatLocalTime(value) : ''}</span>;
        },
        meta: {
          className: 'col-computed-arrival computed',
          title: t('calculatedArrivalTime'),
        },
      }),
      columnHelper.accessor('stopDuration', {
        header: () => t('stopTime'),
        cell: (info) => (
          <DurationCell
            ref={registerTimeCellRef(info.row.index, 'stopDuration')}
            {...info}
            onChange={(e) =>
              info.table.options.meta!.onStopDurationChange(info.row.original, e.target.value)
            }
          />
        ),
        meta: {
          className: 'col-stop-duration',
          tabbable: true,
          title: t('stopTime'),
        },
      }),
      columnHelper.accessor('requestedDeparture', {
        header: () => t('departureTime'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <TimeCell
              ref={registerTimeCellRef(info.row.index, 'requestedDeparture')}
              {...info}
              referenceDate={getDepartureReferenceDate(row, startTime)}
              prefillValue={row.computedDeparture}
              onEnterKeyDown={() => focusCellBelow(info.row.index, 'requestedDeparture')}
              onTabKeyDown={(direction) =>
                focusRequestedCellOnTab(info.row.index, 'requestedDeparture', direction)
              }
              onCommit={(date, propagationMode) =>
                info.table.options.meta!.onDepartureChange(row, date, propagationMode)
              }
            />
          );
        },
        meta: {
          className: 'col-requested-departure',
          tabbable: true,
          title: t('departureTime'),
        },
      }),
      columnHelper.accessor('computedDeparture', {
        header: () => t('calculatedDepartureTime'),
        cell: (info) => {
          if (info.table.options.meta!.isComputedDataPending) {
            return <span className="cell-loading-placeholder" />;
          }
          const value = info.getValue();
          return <span>{value ? formatLocalTime(value) : ''}</span>;
        },
        meta: {
          className: 'col-computed-departure computed',
          title: t('calculatedDepartureTime'),
        },
      }),
      columnHelper.accessor('closedSignal', {
        header: () => t('receptionOnClosedSignal'),
        cell: (info) => {
          const { closedSignal, stopDuration, shortSlipDistance } = info.row.original;
          const isDisabled = !stopDuration;

          return (
            <Checkbox
              id={`closedSignal-${info.row.id}`}
              small
              checked={!!closedSignal}
              disabled={isDisabled}
              onChange={() => {
                if (!isDisabled) {
                  const newClosedSignal = !closedSignal;
                  // When unchecking closedSignal, also reset shortSlipDistance to false
                  const signal = onStopSignalToReceptionSignal(
                    newClosedSignal,
                    newClosedSignal ? shortSlipDistance : false
                  );
                  info.table.options.meta!.onReceptionSignalChange(info.row.original, signal);
                }
              }}
            />
          );
        },
        meta: {
          className: 'col-closed-signal',
          title: t('receptionOnClosedSignalFull'),
        },
      }),
      columnHelper.accessor('shortSlipDistance', {
        header: () => t('shortSlipDistance'),
        cell: (info) => {
          const { closedSignal, shortSlipDistance } = info.row.original;
          const isDisabled = !closedSignal;

          return (
            <Checkbox
              id={`shortSlipDistance-${info.row.id}`}
              small
              checked={!!shortSlipDistance}
              disabled={isDisabled}
              onChange={() => {
                if (!isDisabled) {
                  const signal = onStopSignalToReceptionSignal(closedSignal, !shortSlipDistance);
                  info.table.options.meta!.onReceptionSignalChange(info.row.original, signal);
                }
              }}
            />
          );
        },
        meta: {
          className: 'col-short-slip-distance',
          title: t('shortSlipDistance'),
        },
      }),
      columnHelper.accessor('powerRestriction', {
        header: () => t('powerRestriction'),
        meta: {
          className: 'col-power-restriction',
        },
      }),
      columnHelper.accessor('requestedTheoreticalMargin', {
        header: () => t('requestedTheoreticalMargin'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <MarginCell
              {...info}
              editable
              onCommit={(value) => info.table.options.meta!.onRequestedMarginChange(row, value)}
            />
          );
        },
        meta: {
          className: 'col-requested-theoretical-margin',
          title: t('requestedTheoreticalMargin'),
        },
      }),
      columnHelper.accessor('computedTheoreticalMarginSeconds', {
        header: () => t('computedTheoreticalMargin'),
        cell: (info) => <MarginCell {...info} editable={false} />,
        meta: {
          className: 'col-computed-theoretical-margin computed computed-margin',
          title: t('computedTheoreticalMargin'),
        },
      }),
      columnHelper.accessor('realMargin', {
        header: () => t('realMargin'),
        cell: (info) => <MarginCell {...info} editable={false} />,
        meta: {
          className: 'col-real-margin computed computed-margin',
          title: t('realMargin'),
        },
      }),
      columnHelper.accessor('marginsDifference', {
        header: () => t('diffMargins'),
        cell: (info) => <MarginCell showPolarity {...info} editable={false} />,
        meta: {
          className: 'col-margins-difference computed computed-margin',
          title: t('diffMargins'),
        },
      }),
      columnHelper.accessor('timeFromPreviousOp', {
        header: () => t('timeFromPreviousOp'),
        meta: {
          className: 'col-time-from-previous-op computed',
        },
      }),
      columnHelper.accessor('totalTravelTime', {
        header: () => t('totalTravelTime'),
        meta: {
          className: 'col-total-travel-time computed',
        },
      }),
    ],
    [startTime, focusCellBelow, focusRequestedCellOnTab, t]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      allRows: rows,
      isComputedDataPending,
      onArrivalChange,
      onStopDurationChange,
      onDepartureChange,
      onReceptionSignalChange,
      onRequestedMarginChange,
    },
  });

  const tabbableColumns = table
    .getAllColumns()
    .filter((column) => column.columnDef.meta?.tabbable)
    .map((column) => column.id as TabbableCellColumnId);

  const tabOrder = rows.flatMap((row, index) =>
    tabbableColumns
      .filter((columnId) => !(columnId === 'requestedDeparture' && row.opOnPathIndex === 0))
      .map((columnId) => getTimeCellKey(index, columnId))
  );

  cellTabOrderRef.current = new Map(
    tabOrder.map((key, i) => [
      key,
      { next: tabOrder[i + 1] ?? null, prev: tabOrder[i - 1] ?? null },
    ])
  );

  const getRowDayOffset = (row: Row<TimesStopsRowNew>) =>
    calculateTimeDifferenceInDays(
      startTime,
      row.original.computedArrival ?? row.original.requestedArrival ?? undefined
    ) ?? 0;

  if (rows.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <p className="pt-1 px-5">{t('noPathLoaded')}</p>
      </div>
    );
  }

  return (
    <div
      className={cx('times-stops-table-new', { 'computed-data-pending': isComputedDataPending })}
    >
      <table className="table-container">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={header.column.columnDef.meta?.className}
                  title={header.column.columnDef.meta?.title}
                >
                  <div className="th-content">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          className={cx({
            invalid: !isValid || scheduleNotHonored,
          })}
        >
          {table.getRowModel().rows.map((row, rowIndex) => {
            const prevRow = rowIndex > 0 ? table.getRowModel().rows[rowIndex - 1] : null;
            const rowArrivalDate = row.original.computedArrival ?? row.original.requestedArrival;
            const dayOffset = getRowDayOffset(row);
            const prevDayOffset = prevRow ? getRowDayOffset(prevRow) : 0;

            return (
              <Fragment key={row.id}>
                {dayOffset > prevDayOffset && (
                  <tr className="day-change-banner">
                    <td colSpan={row.getVisibleCells().length}>
                      <div className="day-change-banner-content">
                        <Moon />
                        <span>
                          {rowArrivalDate?.toLocaleDateString(dateTimeLocale, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  className={cx({
                    'invalid-path-step': row.original.stepStatus === 'invalidPathStep',
                  })}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimesStopsTable;
