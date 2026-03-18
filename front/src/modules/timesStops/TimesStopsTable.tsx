import { useCallback, useMemo, useRef } from 'react';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowData,
} from '@tanstack/react-table';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { formatLocalTime } from 'utils/date';

import DurationCell from './DurationCell';
import TimeCell, { type TimeCellHandle } from './TimeCell';
import { type TimesStopsRowNew } from './types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className: string;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    allRows: TimesStopsRowNew[];
    isComputedDataPending?: boolean;
    onArrivalChange: (row: TimesStopsRowNew, arrival: Date | null) => void;
    onStopDurationChange: (row: TimesStopsRowNew, durationSeconds: number | null) => void;
    onDepartureChange: (row: TimesStopsRowNew, departure: Date | null) => void;
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
  onArrivalChange: (row: TimesStopsRowNew, arrival: Date | null) => void;
  onStopDurationChange: (row: TimesStopsRowNew, durationSeconds: number | null) => void;
  onDepartureChange: (row: TimesStopsRowNew, departure: Date | null) => void;
};

const columnHelper = createColumnHelper<TimesStopsRowNew>();
const getTimeCellKey = (rowIndex: number, columnId: string) => `${rowIndex}-${columnId}`;

const TimesStopsTable = ({
  rows,
  startTime,
  isValid,
  isComputedDataPending,
  onArrivalChange,
  onStopDurationChange,
  onDepartureChange,
}: TimesStopsTableProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable' });
  const scheduleNotHonored = rows.some((row) => row.stepStatus === 'scheduleNotHonored');
  const cellHandlesRef = useRef<Map<string, TimeCellHandle>>(new Map());

  const registerTimeCellRef = useCallback(
    (rowIndex: number, columnId: string) => (handle: TimeCellHandle | null) => {
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
              onCommit={(date) => onArrival(row, date)}
            />
          );
        },
        meta: {
          className: 'col-requested-arrival',
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
        },
      }),
      columnHelper.accessor('stopDuration', {
        header: () => t('stopTime'),
        cell: (info) => (
          <DurationCell
            {...info}
            onChange={(e) =>
              info.table.options.meta!.onStopDurationChange(info.row.original, e.target.value)
            }
          />
        ),
        meta: {
          className: 'col-stop-duration',
        },
      }),
      columnHelper.accessor('requestedDeparture', {
        header: () => t('departureTime'),
        cell: (info) => {
          const row = info.row.original;
          // Disable departure editing on the first row (origin)
          if (row.opOnPathIndex === 0) {
            const value = info.getValue();
            return <span>{value ? formatLocalTime(value) : ''}</span>;
          }
          return (
            <TimeCell
              ref={registerTimeCellRef(info.row.index, 'requestedDeparture')}
              {...info}
              referenceDate={getDepartureReferenceDate(row, startTime)}
              prefillValue={row.computedDeparture}
              onEnterKeyDown={() => focusCellBelow(info.row.index, 'requestedDeparture')}
              onCommit={(date) => info.table.options.meta!.onDepartureChange(row, date)}
            />
          );
        },
        meta: {
          className: 'col-requested-departure',
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
        },
      }),
      columnHelper.accessor('closedSignal', {
        header: () => t('receptionOnClosedSignal'),
        cell: (info) => <input type="checkbox" checked={info.getValue()} readOnly />,
        meta: {
          className: 'col-closed-signal',
        },
      }),
      columnHelper.accessor('shortSlipDistance', {
        header: () => t('shortSlipDistance'),
        cell: (info) => {
          const { closedSignal, shortSlipDistance } = info.row.original;
          return (
            <input type="checkbox" checked={shortSlipDistance} disabled={!closedSignal} readOnly />
          );
        },
        meta: {
          className: 'col-short-slip-distance',
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
        meta: {
          className: 'col-requested-theoretical-margin',
        },
      }),
      columnHelper.accessor('computedTheoreticalMarginSeconds', {
        header: () => t('computedTheoreticalMargin'),
        meta: {
          className: 'col-computed-theoretical-margin computed',
        },
      }),
      columnHelper.accessor('realMargin', {
        header: () => t('realMargin'),
        meta: {
          className: 'col-real-margin computed',
        },
      }),
      columnHelper.accessor('marginsDifference', {
        header: () => t('diffMargins'),
        meta: {
          className: 'col-margins-difference computed',
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
    [startTime, focusCellBelow]
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
    },
  });

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
                <th key={header.id} className={header.column.columnDef.meta?.className}>
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
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimesStopsTable;
