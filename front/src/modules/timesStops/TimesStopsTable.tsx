import React, { useCallback, Fragment, useMemo, useRef } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Alert, Moon, TriangleDown } from '@osrd-project/ui-icons';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type Row,
  type RowData,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { ReceptionSignal } from 'common/api/osrdEditoastApi';
import { SkeletonLoader } from 'common/Loaders';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import { useDateTimeLocale } from 'utils/date';
import { type Duration, type StartTime, subtractStartTime } from 'utils/duration';

import DurationCell, { type DurationCellHandle } from './DurationCell';
import type { PowerRestrictionBlockInfo } from './helpers/powerRestrictionIncompatibility';
import { onStopSignalToReceptionSignal, truncateStartTimeToDay } from './helpers/utils';
import MarginCell from './MarginCell';
import StartTimeCell from './StartTimeCell';
import type { TimeCellHandle } from './TimeCell';
import type { MarginValue, PropagationMode, StopPropagationMode, TimesStopsRowNew } from './types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ColumnMeta<TData extends RowData, TValue> {
    className: string;
    tabbable?: boolean;
    title?: string;
    'data-testid'?: string;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface TableMeta<TData extends RowData> {
    allRows: TimesStopsRowNew[];
    isComputedDataPending?: boolean;
    availablePowerRestrictions: string[];
    powerRestrictionWarningCount: number;
    powerRestrictionBlocks: Map<string, PowerRestrictionBlockInfo>;
    onArrivalChange: (
      row: TimesStopsRowNew,
      arrival: StartTime | null,
      propagationMode: PropagationMode
    ) => void;
    onStopDurationChange: (
      row: TimesStopsRowNew,
      durationSeconds: number | null,
      propagationMode: StopPropagationMode
    ) => void;
    onDepartureChange: (
      row: TimesStopsRowNew,
      departure: StartTime | null,
      propagationMode: PropagationMode
    ) => void;
    onReceptionSignalChange: (row: TimesStopsRowNew, signal: ReceptionSignal | undefined) => void;
    onRequestedMarginChange: (row: TimesStopsRowNew, requestedMargin: MarginValue | null) => void;
    onPowerRestrictionChange: (row: TimesStopsRowNew, value: string | null) => void;
    onReferenceBaseArrivalChange: (
      row: TimesStopsRowNew,
      arrival: StartTime | null,
      propagationMode: PropagationMode
    ) => void;
  }
}

const formatTime = (t: StartTime, locale: Intl.Locale) =>
  t instanceof Date
    ? t.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : t.toLocaleString(locale, { style: 'digital', hours: '2-digit' });

/**
 * Get the reference date for arrival editing.
 * The TimeCell bumps any typed time that falls before this date to the next day,
 * so returning the previous stop's time means "anything earlier than this is D+1".
 */
const getArrivalReferenceDate = (
  row: TimesStopsRowNew,
  allRows: TimesStopsRowNew[],
  startTime: StartTime
): Date | undefined => {
  if (!(startTime instanceof Date)) return undefined;

  const previousRow = allRows.findLast(
    (r) => r.opOnPathIndex < row.opOnPathIndex && (r.requestedDeparture || r.requestedArrival)
  );

  if (!previousRow) return truncateStartTimeToDay(startTime) as Date;

  const refDate = previousRow.requestedDeparture ?? previousRow.requestedArrival ?? startTime;
  if (!(refDate instanceof Date)) {
    throw new Error('requestedDeparture and requestedArrival must be a Date');
  }
  return refDate;
};

/**
 * Get the reference date for departure editing.
 * Uses the current row's arrival time since departure must be after arrival.
 */
const getDepartureReferenceDate = (
  row: TimesStopsRowNew,
  startTime: StartTime
): Date | undefined => {
  if (!(startTime instanceof Date)) return undefined;
  const refDate = row.requestedArrival ?? row.computedArrival ?? startTime;
  if (!(refDate instanceof Date)) {
    throw new Error('requestedArrival and computedArrival must be a Date');
  }
  return refDate;
};

/**
 * Check if the OP is a scheduled OP.
 * Uses the requested departure, arrival time or stop time to determine scheduling.
 */
const isScheduledOP = (row: TimesStopsRowNew): boolean =>
  !!row.requestedDeparture || !!row.requestedArrival || !!row.stopDuration;

type TimesStopsTableProps = {
  rows: TimesStopsRowNew[];
  startTime: StartTime;
  isValid: boolean;
  isComputedDataPending?: boolean;
  availablePowerRestrictions: string[];
  powerRestrictionWarningCount?: number;
  powerRestrictionBlocks?: Map<string, PowerRestrictionBlockInfo>;
  onArrivalChange: (
    row: TimesStopsRowNew,
    arrival: StartTime | null,
    propagationMode: PropagationMode
  ) => void;
  onStopDurationChange: (
    row: TimesStopsRowNew,
    durationSeconds: number | null,
    propagationMode: StopPropagationMode
  ) => void;
  onDepartureChange: (
    row: TimesStopsRowNew,
    departure: StartTime | null,
    propagationMode: PropagationMode
  ) => void;
  onReceptionSignalChange: (row: TimesStopsRowNew, signal: ReceptionSignal | undefined) => void;
  onRequestedMarginChange: (row: TimesStopsRowNew, value: MarginValue | null) => void;
  onPowerRestrictionChange: (row: TimesStopsRowNew, value: string | null) => void;
  onReferenceBaseArrivalChange: (
    row: TimesStopsRowNew,
    arrival: StartTime | null,
    propagationMode: PropagationMode
  ) => void;
};

const columnHelper = createColumnHelper<TimesStopsRowNew>();
const getTimeCellKey = (rowIndex: number, columnId: string) => `${rowIndex}-${columnId}`;
type TabbableCellColumnId = 'requestedArrival' | 'stopDuration' | 'requestedDeparture';
type TabbableCellHandle = TimeCellHandle | DurationCellHandle;
type TimeCellTabEntry = {
  next: string | null;
  prev: string | null;
};

const HEADER_HEIGHT = 40;

/**
 * height: 47px + border-bottom: 1px (see _timesStopsTable.scss)
 */
const POWER_RESTRICTION_WARNING_HEIGHT = 48;

const ROW_HEIGHT = 40;
const DAY_CHANGE_BANNER_HEIGHT = 40;

const TimesStopsTable = ({
  rows,
  startTime,
  isValid,
  isComputedDataPending,
  availablePowerRestrictions,
  powerRestrictionWarningCount = 0,
  powerRestrictionBlocks,
  onArrivalChange,
  onStopDurationChange,
  onDepartureChange,
  onReceptionSignalChange,
  onRequestedMarginChange,
  onPowerRestrictionChange,
  onReferenceBaseArrivalChange,
}: TimesStopsTableProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable' });
  const dateTimeLocale = useDateTimeLocale();
  const { scenario } = useScenarioContext();
  const scheduleNotHonored = rows.some((row) => row.stepStatus === 'scheduleNotHonored');
  const cellHandlesRef = useRef<Map<string, TabbableCellHandle>>(new Map());
  const cellTabOrderRef = useRef<Map<string, TimeCellTabEntry>>(new Map());
  const startTimeCellType: 'time' | 'duration' =
    scenario.timetable_type === 'CALENDAR' ? 'time' : 'duration';

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

  const returnMarginCell = ({
    info,
    showPolarity,
    editable,
    dataTestId,
  }: {
    info: CellContext<TimesStopsRowNew, MarginValue | undefined>;
    showPolarity?: boolean;
    editable?: boolean;
    dataTestId: string;
  }) => {
    const { allRows } = info.table.options.meta!;
    const isLastRow = info.row.index === allRows.length - 1;
    if (info.table.options.meta!.isComputedDataPending && !isLastRow) {
      return <SkeletonLoader className="cell-loading-placeholder" />;
    }
    const marginValue = info.getValue() ?? null;
    return (
      <MarginCell
        data-testid={dataTestId}
        marginValue={marginValue}
        showPolarity={showPolarity}
        editable={editable}
      />
    );
  };

  const returnRequestTheoreticalMarginCell = (
    info: CellContext<TimesStopsRowNew, MarginValue | undefined>
  ) => {
    const { allRows } = info.table.options.meta!;
    const row = info.row.original;
    const isFirstRow = info.row.index === 0;
    const isLastRow = info.row.index === allRows.length - 1;

    if (isLastRow) return null;

    const marginValue =
      isScheduledOP(row) || !!row.requestedTheoreticalMargin
        ? row.requestedTheoreticalMargin
        : null;
    const isInherited = !row.isTheoreticalMarginBoundary || !row.requestedTheoreticalMargin;

    return (
      <div data-testid="requested-theoretical-margin">
        <MarginCell
          data-testid="margin-cell-editable"
          marginValue={marginValue ?? null}
          editable={!isLastRow}
          isInherited={isFirstRow ? false : isInherited}
          isFirstRow={isFirstRow}
          onCommit={(value) => info.table.options.meta!.onRequestedMarginChange(row, value)}
        />
      </div>
    );
  };

  const returnShortSlipDistanceCell = (
    info: CellContext<TimesStopsRowNew, boolean | undefined>
  ) => {
    const { closedSignal, shortSlipDistance } = info.row.original;
    const isDisabled = !closedSignal;

    return (
      <Checkbox
        id={`shortSlipDistance-${info.row.id}`}
        data-testid="short-slip-distance"
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
  };

  const returnPowerRestrictionCell = (info: CellContext<TimesStopsRowNew, string | null>) => {
    const {
      availablePowerRestrictions: codes,
      powerRestrictionBlocks: blocks,
      onPowerRestrictionChange: onRestrictionChange,
    } = info.table.options.meta!;
    const value = info.getValue();
    const row = info.row.original;

    // On the first row of an incompatible block, display the propagated restriction
    // in a lighter style so the user can see which code is causing the warning and
    // edit it directly at the boundary.
    const blockInfo = blocks.get(row.id);
    const showPropagated =
      value === null && blockInfo?.isBlockStart && blockInfo.propagatedValue !== null;
    const displayedValue = showPropagated ? blockInfo.propagatedValue : value;

    return (
      <div
        className={cx('power-restriction-select-wrapper', {
          'power-restriction-propagated': showPropagated,
        })}
      >
        <select
          data-testid="power-restriction-select"
          value={displayedValue ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onRestrictionChange(row, v === '' ? null : v);
          }}
        >
          <option value="" data-testid="power-restriction-option-empty"></option>
          <option
            value={NO_POWER_RESTRICTION}
            data-testid={`power-restriction-option-${NO_POWER_RESTRICTION}`}
          >
            Ø
          </option>
          {codes.map((c) => (
            <option key={c} value={c} data-testid={`power-restriction-option-${c}`}>
              {c}
            </option>
          ))}
        </select>
        <TriangleDown className="power-restriction-arrow" />
      </div>
    );
  };

  const returnDepartureTimeCell = (info: CellContext<TimesStopsRowNew, StartTime | null>) => {
    const row = info.row.original;
    return (
      <StartTimeCell
        type={startTimeCellType}
        ref={registerTimeCellRef(info.row.index, 'requestedDeparture')}
        cellContext={info}
        referenceDate={getDepartureReferenceDate(row, startTime)}
        prefillValue={row.computedDeparture}
        clearButtonTitle={t('clearRequestedDepartureTime')}
        onEnterKeyDown={() => focusCellBelow(info.row.index, 'requestedDeparture')}
        onTabKeyDown={(direction) =>
          focusRequestedCellOnTab(info.row.index, 'requestedDeparture', direction)
        }
        onCommit={(date, propagationMode) =>
          info.table.options.meta!.onDepartureChange(row, date, propagationMode)
        }
      />
    );
  };

  const returnReceptionOnCloseSignalCell = (
    info: CellContext<TimesStopsRowNew, boolean | undefined>
  ) => {
    const { closedSignal, stopDuration, shortSlipDistance } = info.row.original;
    const isDisabled = !stopDuration;

    return (
      <Checkbox
        id={`closedSignal-${info.row.id}`}
        data-testid="signal-reception-closed"
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
  };

  const returnStopDurationCell = (info: CellContext<TimesStopsRowNew, Duration | null>) => (
    <DurationCell
      ref={registerTimeCellRef(info.row.index, 'stopDuration')}
      clearButtonTitle={t('clearStopDuration')}
      {...info}
      onCommit={(seconds, propagationMode) =>
        info.table.options.meta!.onStopDurationChange(info.row.original, seconds, propagationMode)
      }
    />
  );

  const returnStepStatusCell = (info: CellContext<TimesStopsRowNew, unknown>) => {
    if (info.table.options.meta!.isComputedDataPending) {
      return <span data-testid="step-status">&nbsp;</span>;
    }

    const { stepStatus, computedArrival, requestedArrival, pathStepId } = info.row.original;
    const isPathStep = Boolean(pathStepId);

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

    return (
      <span data-testid="step-status" className={className}>
        &nbsp;
      </span>
    );
  };

  const returnOPCell = (info: CellContext<TimesStopsRowNew, string>) => {
    const { name, secondaryCode, pathStepId } = info.row.original;
    return (
      <>
        {pathStepId && <span className="requested-point-dot" data-testid="op-name-dot" />}
        <span
          className="op-full-name"
          data-testid="op-full-name"
          title={`${name}${secondaryCode ? ` ${secondaryCode}` : ''}`}
        >
          {name}
        </span>
        {secondaryCode && (
          <span className="secondary-code" data-testid="secondary-code">
            {secondaryCode}
          </span>
        )}
      </>
    );
  };

  const returnOPOnPathIndexCell = (info: CellContext<TimesStopsRowNew, unknown>) => (
    <span data-testid="row-index">{info.row.original.opOnPathIndex + 1}</span>
  );

  const returnTrackNameCell = (info: CellContext<TimesStopsRowNew, string>) => {
    const { pathStepId, hasRequestedTrack } = info.row.original;
    return (
      <>
        {pathStepId && hasRequestedTrack && (
          <span className="requested-point-dot" data-testid="track-name-dot" />
        )}
        <span data-testid="track-name" title={info.getValue()}>
          {info.getValue() ?? ''}
        </span>
      </>
    );
  };

  const returnArrivalTimeCell = (info: CellContext<TimesStopsRowNew, StartTime | null>) => {
    const row = info.row.original;
    const { allRows, onArrivalChange: onArrival } = info.table.options.meta!;
    return (
      <StartTimeCell
        type={startTimeCellType}
        ref={registerTimeCellRef(info.row.index, 'requestedArrival')}
        cellContext={info}
        referenceDate={getArrivalReferenceDate(row, allRows, startTime)}
        prefillValue={row.computedArrival}
        clearButtonTitle={t('clearRequestedArrivalTime')}
        onEnterKeyDown={() => focusCellBelow(info.row.index, 'requestedArrival')}
        onTabKeyDown={(direction) =>
          focusRequestedCellOnTab(info.row.index, 'requestedArrival', direction)
        }
        onCommit={(date, propagationMode) => onArrival(row, date, propagationMode)}
        disableClear={info.row.index === 0}
      />
    );
  };

  const returnCalculatedArrivalTimeCell = (
    info: CellContext<TimesStopsRowNew, StartTime | null>
  ) => {
    if (info.table.options.meta!.isComputedDataPending) {
      return <SkeletonLoader className="cell-loading-placeholder" />;
    }
    const value = info.getValue();
    return (
      <span data-testid="computed-arrival">{value ? formatTime(value, dateTimeLocale) : ''}</span>
    );
  };

  const returnCalculatedDepartureTimeCell = (
    info: CellContext<TimesStopsRowNew, StartTime | null>
  ) => {
    if (info.table.options.meta!.isComputedDataPending) {
      return <SkeletonLoader className="cell-loading-placeholder" />;
    }
    const value = info.getValue();
    const isEmpty = !value;
    return (
      <span data-testid="computed-departure" className={cx({ 'cell-empty-dot': isEmpty })}>
        {isEmpty ? '•' : formatTime(value, dateTimeLocale)}
      </span>
    );
  };

  const returnBaseArrival = (info: CellContext<TimesStopsRowNew, StartTime | null>) => {
    const row = info.row.original;
    const { allRows } = info.table.options.meta!;

    const isFirstRow = info.row.index === 0;

    if (isFirstRow) {
      const value = row.requestedArrival;
      return (
        <span data-testid="first-base-arrival">
          {value ? formatTime(value, dateTimeLocale) : ''}
        </span>
      );
    } else if (scheduleNotHonored || !isValid) {
      return (
        <StartTimeCell
          type={startTimeCellType}
          ref={registerTimeCellRef(info.row.index, 'baseArrival')}
          cellContext={info}
          referenceDate={getArrivalReferenceDate(row, allRows, startTime)}
          clearButtonTitle={t('clearRequestedArrivalTime')}
          onEnterKeyDown={() => focusCellBelow(info.row.index, 'baseArrival')}
          onCommit={(date, propagationMode) => {
            info.table.options.meta!.onReferenceBaseArrivalChange(row, date, propagationMode);
          }}
        />
      );
    } else {
      const value = info.getValue();
      return (
        <span data-testid="computed-base-arrival">
          {value ? formatTime(value, dateTimeLocale) : ''}
        </span>
      );
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'opOnPathIndex',
        header: '',
        cell: returnOPOnPathIndexCell,
        meta: {
          className: 'col-index computed',
        },
      }),
      columnHelper.display({
        id: 'stepStatus',
        header: '',
        cell: returnStepStatusCell,
        meta: {
          className: 'col-step-status computed',
        },
      }),
      columnHelper.accessor('name', {
        header: () => t('operational_point'),
        cell: returnOPCell,
        meta: {
          className: 'col-name computed',
          title: t('operational_point'),
        },
      }),
      columnHelper.accessor('track', {
        header: () => t('trackName'),
        cell: returnTrackNameCell,
        meta: {
          className: 'col-track computed',
          title: t('trackName'),
        },
      }),
      columnHelper.accessor('requestedArrival', {
        header: () => t('arrivalTime'),
        cell: returnArrivalTimeCell,
        meta: {
          className: 'col-requested-arrival col-with-clock-time',
          tabbable: true,
          title: t('arrivalTime'),
        },
      }),
      columnHelper.accessor('computedArrival', {
        header: () => t('calculatedArrivalTime'),
        cell: returnCalculatedArrivalTimeCell,
        meta: {
          className: 'col-computed-arrival col-with-clock-time computed',
          title: t('calculatedArrivalTime'),
        },
      }),
      columnHelper.accessor('stopDuration', {
        header: () => t('stopTime'),
        cell: returnStopDurationCell,
        meta: {
          className: 'col-stop-duration col-with-duration',
          tabbable: true,
          title: t('stopTime'),
        },
      }),
      columnHelper.accessor('requestedDeparture', {
        header: () => t('departureTime'),
        cell: returnDepartureTimeCell,
        meta: {
          className: 'col-requested-departure col-with-clock-time',
          tabbable: true,
          title: t('departureTime'),
        },
      }),
      columnHelper.accessor('computedDeparture', {
        header: () => t('calculatedDepartureTime'),
        cell: returnCalculatedDepartureTimeCell,
        meta: {
          className: 'col-computed-departure col-with-clock-time computed',
          title: t('calculatedDepartureTime'),
        },
      }),
      columnHelper.accessor('closedSignal', {
        header: () => t('receptionOnClosedSignal'),
        cell: returnReceptionOnCloseSignalCell,
        meta: {
          className: 'col-closed-signal col-with-checkbox',
          title: t('receptionOnClosedSignalFull'),
        },
      }),
      columnHelper.accessor('shortSlipDistance', {
        header: () => t('shortSlipDistance'),
        cell: returnShortSlipDistanceCell,
        meta: {
          className: 'col-short-slip-distance col-with-checkbox',
          title: t('shortSlipDistance'),
        },
      }),
      columnHelper.accessor('powerRestriction', {
        header: () => t('powerRestriction'),
        cell: returnPowerRestrictionCell,
        meta: {
          className: 'col-power-restriction',
        },
      }),
      columnHelper.accessor('requestedTheoreticalMargin', {
        header: () => t('requestedTheoreticalMargin'),
        cell: returnRequestTheoreticalMarginCell,
        meta: {
          className: 'col-requested-theoretical-margin',
          title: t('requestedTheoreticalMargin'),
        },
      }),
      columnHelper.accessor('computedTheoreticalMarginSeconds', {
        header: () => t('computedTheoreticalMargin'),
        cell: (info) => returnMarginCell({ info, dataTestId: 'computed-theoretical-margin' }),
        meta: {
          className: 'col-computed-theoretical-margin computed computed-margin',
          title: t('computedTheoreticalMargin'),
        },
      }),
      columnHelper.accessor('realMargin', {
        header: () => t('realMargin'),
        cell: (info) => returnMarginCell({ info, dataTestId: 'real-margin' }),
        meta: {
          className: 'col-real-margin computed computed-margin',
          title: t('realMargin'),
        },
      }),
      columnHelper.accessor('marginsDifference', {
        header: () => t('diffMargins'),
        cell: (info) =>
          returnMarginCell({ info, showPolarity: true, dataTestId: 'margins-difference' }),
        meta: {
          className: 'col-margins-difference computed computed-margin',
          title: t('diffMargins'),
        },
      }),
      columnHelper.accessor('timeFromPreviousOp', {
        header: () => t('timeFromPreviousOp'),
        meta: {
          className: 'col-time-from-previous-op col-with-duration computed',
          'data-testid': 'time-from-previous-op',
        },
      }),
      columnHelper.accessor('totalTravelTime', {
        header: () => t('totalTravelTime'),
        meta: {
          className: 'col-total-travel-time col-with-duration computed',
          'data-testid': 'total-travel-time',
        },
      }),
      columnHelper.accessor('baseArrival', {
        header: () => t('baseArrival'),
        cell: returnBaseArrival,
        meta: {
          className: 'col-reference-base-arrivial col-with-clock-time',
          'data-testid': 'reference-base-arrivial',
        },
      }),
    ],
    [startTime, focusCellBelow, focusRequestedCellOnTab, t, scheduleNotHonored]
  );

  // eslint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      allRows: rows,
      isComputedDataPending,
      availablePowerRestrictions,
      powerRestrictionWarningCount,
      powerRestrictionBlocks: powerRestrictionBlocks ?? new Map(),
      onArrivalChange,
      onStopDurationChange,
      onDepartureChange,
      onReceptionSignalChange,
      onRequestedMarginChange,
      onPowerRestrictionChange,
      onReferenceBaseArrivalChange,
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

  const getRowDayOffset = (row: Row<TimesStopsRowNew>): number | null => {
    if (!row.original.pathStepId) return null;
    const arrival = row.original.computedArrival ?? row.original.requestedArrival;
    if (!arrival) return null;
    const diff = subtractStartTime(
      truncateStartTimeToDay(arrival),
      truncateStartTimeToDay(startTime)
    );
    return diff.total('day');
  };

  const tableRows = table.getRowModel().rows;

  /**
   * For each row, compute the effective day offset relative to the train start time.
   * Non-path-step rows (e.g. via points without times) inherit the previous row's offset
   * so that day-change banners are only shown when the day actually changes.
   */
  const effectiveDayOffsets = tableRows.reduce<number[]>((acc, row, i) => {
    const rawOffset = getRowDayOffset(row);
    if (rawOffset !== null) {
      acc.push(rawOffset);
    } else {
      const prevOffset = i > 0 ? acc[i - 1] : 0;
      acc.push(prevOffset);
    }
    return acc;
  }, []);

  const virtualizedWrapperRef = React.useRef<HTMLDivElement>(null);

  // TODO: Replace this (punching-hole) query selector by a proper refactoring
  //       of our outer layout so we only rely on the scroll offset of the viewport,
  //       which would also allow us to use `useWindowVirtualizer`!
  const centerColumn = document.querySelector('.center-column');

  const virtualizer = useVirtualizer({
    count: rows.length,
    overscan: 10,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => centerColumn,
    scrollMargin: virtualizedWrapperRef.current?.offsetTop,
    useFlushSync: false,
    measureElement: (element) =>
      (element.classList.contains('day-change-banner') ? DAY_CHANGE_BANNER_HEIGHT : 0) + ROW_HEIGHT,
  });

  if (rows.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <p className="pt-1 px-5">{t('noPathLoaded')}</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  let height = virtualizer.getTotalSize() + HEADER_HEIGHT;
  if (powerRestrictionWarningCount > 0) {
    height += POWER_RESTRICTION_WARNING_HEIGHT;
  }

  return (
    <div
      className={cx('times-stops-table-new', { 'computed-data-pending': isComputedDataPending })}
      data-testid="times-stops-table-new"
      ref={virtualizedWrapperRef}
      style={{ height: `${height}px` }}
    >
      <table className="table-container">
        {powerRestrictionWarningCount > 0 && (
          <caption className="power-restriction-warning">
            <div className="power-restriction-warning-content">
              <Alert variant="fill" />
              <span>
                {t('powerRestrictionIncompatibility', { count: powerRestrictionWarningCount })}
              </span>
            </div>
          </caption>
        )}
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
          {virtualItems.map((virtualRow) => {
            const rowIndex = virtualRow.index;
            const row = tableRows[rowIndex];

            const rowArrivalDate = row.original.computedArrival ?? row.original.requestedArrival;
            const dayOffset = effectiveDayOffsets[rowIndex];
            const prevDayOffset = rowIndex > 0 ? effectiveDayOffsets[rowIndex - 1] : 0;
            const hasDayChanged = dayOffset > prevDayOffset;

            let dayChangeLabel = null;
            if (hasDayChanged) {
              if (rowArrivalDate instanceof Date) {
                dayChangeLabel = rowArrivalDate.toLocaleDateString(dateTimeLocale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });
              } else {
                dayChangeLabel = t('dayCounter', { count: dayOffset });
              }
            }

            const translateY = (virtualItems.at(0)?.start ?? 0) - virtualizer.options.scrollMargin;

            return (
              <Fragment key={row.id}>
                {hasDayChanged && (
                  <tr
                    className="day-change-banner"
                    data-testid="day-change-banner"
                    style={{
                      transform: `translateY(${translateY}px)`,
                    }}
                    data-index={rowIndex}
                    ref={virtualizer.measureElement}
                  >
                    <td colSpan={row.getVisibleCells().length}>
                      <div className="day-change-banner-content">
                        <Moon />
                        <span>{dayChangeLabel}</span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  className={cx({
                    'invalid-path-step': row.original.stepStatus === 'invalidPathStep',
                    'odd-row': rowIndex % 2 === 0,
                    'even-row': rowIndex % 2,
                    'first-row': rowIndex === 0,
                    'last-row': rowIndex === tableRows.length - 1,
                  })}
                  style={{
                    transform: `translateY(${translateY}px)`,
                  }}
                  data-index={rowIndex}
                  data-testid="times-stops-data-row"
                  ref={!hasDayChanged ? virtualizer.measureElement : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cx(cell.column.columnDef.meta?.className, {
                        'power-restriction-incompatible':
                          cell.column.id === 'powerRestriction' &&
                          table.options.meta!.powerRestrictionBlocks.get(row.original.id)
                            ?.hasWarning,
                      })}
                      data-testid={cell.column.columnDef.meta?.['data-testid']}
                    >
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
