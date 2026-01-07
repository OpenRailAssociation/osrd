import { useMemo } from 'react';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { Loader } from 'common/Loaders/Loader';
import { formatLocalTime } from 'utils/date';

import type { TimesStopsRowNew } from './types';

type TimesStopsTableProps = {
  rows: TimesStopsRowNew[];
  dataIsLoading: boolean;
};

const columnHelper = createColumnHelper<TimesStopsRowNew>();

const TimesStopsTable = ({ rows, dataIsLoading }: TimesStopsTableProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable' });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'index',
        cell: (info) => info.row.original.index + 1,
        meta: {
          className: 'col-index',
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
          className: 'col-name',
        },
      }),
      columnHelper.accessor('track', {
        header: () => t('trackName'),
        cell: (info) => info.getValue() ?? '',
        meta: {
          className: 'col-track',
        },
      }),
      columnHelper.accessor('requestedArrival', {
        header: () => t('arrivalTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
        meta: {
          className: 'col-arrivalTime',
        },
      }),
      columnHelper.accessor('computedArrival', {
        header: () => t('calculatedArrivalTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
        meta: {
          className: 'col-computedArrival',
        },
      }),
      columnHelper.accessor('stopDuration', {
        header: () => t('stopTime'),
        cell: (info) => info.getValue()?.total('second') ?? '',
        meta: {
          className: 'col-stopDuration',
        },
      }),
      columnHelper.accessor('requestedDeparture', {
        header: () => t('departureTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
        meta: {
          className: 'col-requestedDeparture',
        },
      }),
      columnHelper.accessor('computedDeparture', {
        header: () => t('calculatedDepartureTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
        meta: {
          className: 'col-computedDeparture',
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
                <th
                  key={header.id}
                  className={(header.column.columnDef.meta as { className?: string })?.className}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={(cell.column.columnDef.meta as { className?: string })?.className}
                >
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
