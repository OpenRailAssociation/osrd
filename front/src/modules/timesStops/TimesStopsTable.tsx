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

import { Loader } from 'common/Loaders/Loader';
import { formatLocalTime } from 'utils/date';

import DurationCell from './DurationCell';
import TimeCell from './TimeCell';
import type { TimesStopsRowNew } from './types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className: string;
  }
}

type TimesStopsTableProps = {
  rows: TimesStopsRowNew[];
  dataIsLoading: boolean;
  isValid: boolean;
};

const columnHelper = createColumnHelper<TimesStopsRowNew>();

const TimesStopsTable = ({ rows, dataIsLoading, isValid }: TimesStopsTableProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable' });

  const scheduleNotHonored = rows.some((row) => row.scheduleNotHonored);

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
        cell: (info) => <TimeCell {...info} />,
        meta: {
          className: 'col-requested-arrival',
        },
      }),
      columnHelper.accessor('computedArrival', {
        header: () => t('calculatedArrivalTime'),
        cell: (info) => <span>{info.getValue() ? formatLocalTime(info.getValue()!) : ''}</span>,
        meta: {
          className: 'col-computed-arrival computed',
        },
      }),
      columnHelper.accessor('stopDuration', {
        header: () => t('stopTime'),
        cell: (info) => <DurationCell {...info} />,
        meta: {
          className: 'col-stop-duration',
        },
      }),
      columnHelper.accessor('requestedDeparture', {
        header: () => t('departureTime'),
        cell: (info) => <span>{info.getValue() ? formatLocalTime(info.getValue()!) : ''}</span>,
        meta: {
          className: 'col-requested-departure',
        },
      }),
      columnHelper.accessor('computedDeparture', {
        header: () => t('calculatedDepartureTime'),
        cell: (info) => <span>{info.getValue() ? formatLocalTime(info.getValue()!) : ''}</span>,
        meta: {
          className: 'col-computed-departure computed',
        },
      }),
    ],
    [t]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (dataIsLoading) {
    return (
      <div className="times-stops-table-new-loader">
        <Loader />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <p className="pt-1 px-5">{t('noPathLoaded')}</p>
      </div>
    );
  }

  return (
    <div className="times-stops-table-new">
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
