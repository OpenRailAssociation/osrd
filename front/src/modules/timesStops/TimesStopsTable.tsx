import { useMemo } from 'react';

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
import TimeCell from './TimeCell';
import type { TimesStopsRowNew } from './types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className: string;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    allRows: TimesStopsRowNew[];
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

  const isScheduleNotHonored = rows.some((row) => row.scheduleNotHonored);

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
          if (isComputedDataPending) {
            return <span>&nbsp;</span>;
          }

          const {
            marginNotHonored,
            scheduleNotHonored,
            invalidPathStep,
            computedArrival,
            isPathStep,
          } = info.row.original;

          const isSuccessSchedule = computedArrival && !marginNotHonored && !scheduleNotHonored;

          const className = cx({
            'success-schedule': isPathStep && isSuccessSchedule,
            'warning-schedule': isPathStep && scheduleNotHonored,
            'warning-margin': isPathStep && marginNotHonored && !scheduleNotHonored,
            'invalid-path-step': invalidPathStep,
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
          const { name, secondaryCode } = info.row.original;
          return (
            <div title={`${name}${secondaryCode ? ` ${secondaryCode}` : ''}`}>
              <span>{name}</span>
              {secondaryCode && <span className="secondary-code"> {secondaryCode}</span>}
            </div>
          );
        },
        meta: {
          className: 'col-name computed',
        },
      }),
      columnHelper.accessor('track', {
        header: () => t('trackName'),
        cell: (info) => <span>{info.getValue() ?? ''}</span>,
        meta: {
          className: 'col-track computed',
        },
      }),
      columnHelper.accessor('requestedArrival', {
        header: () => t('arrivalTime'),
        cell: (info) => {
          const { allRows, onArrivalChange: onArrival } = info.table.options.meta!;
          return (
            <TimeCell
              {...info}
              referenceDate={getArrivalReferenceDate(info.row.original, allRows, startTime)}
              onCommit={(date) => onArrival(info.row.original, date)}
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
          if (isComputedDataPending) {
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
              {...info}
              referenceDate={getDepartureReferenceDate(row, startTime)}
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
          if (isComputedDataPending) {
            return <span className="cell-loading-placeholder" />;
          }
          const value = info.getValue();
          return <span>{value ? formatLocalTime(value) : ''}</span>;
        },
        meta: {
          className: 'col-computed-departure computed',
        },
      }),
    ],
    [startTime, isComputedDataPending]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      allRows: rows,
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
            invalid: !isValid || isScheduleNotHonored,
          })}
        >
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cx({
                'invalid-path-step': row.original.invalidPathStep,
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
