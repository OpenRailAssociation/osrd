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

import TimeCell from './TimeCell';
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
        header: '#',
        cell: (info) => info.row.original.index + 1,
      }),
      columnHelper.accessor('name', {
        header: () => t('name'),
        cell: (info) => {
          const name = info.getValue();
          const secondaryCode = info.row.original.secondaryCode;
          const displayName = secondaryCode ? `${name} ${secondaryCode}` : name;
          return (
            <span title={displayName}>
              <span>{name}</span>
              {secondaryCode && <span>{secondaryCode}</span>}
            </span>
          );
        },
      }),
      columnHelper.accessor('track', {
        header: () => t('trackName'),
        cell: (info) => info.getValue() ?? '',
      }),
      columnHelper.accessor('requestedArrival', {
        header: () => t('arrivalTime'),
        cell: (info) => <TimeCell {...info} />,
      }),
      columnHelper.accessor('computedArrival', {
        header: () => t('calculatedArrivalTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
      }),
      columnHelper.accessor('stopDuration', {
        header: () => t('stopTime'),
        cell: (info) => info.getValue()?.total('second') ?? '',
      }),
      columnHelper.accessor('requestedDeparture', {
        header: () => t('departureTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
      }),
      columnHelper.accessor('computedDeparture', {
        header: () => t('calculatedDepartureTime'),
        cell: (info) => (info.getValue() ? formatLocalTime(info.getValue()!) : ''),
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
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimesStopsTable;
