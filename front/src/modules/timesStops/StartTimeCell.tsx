import type { CellContext } from '@tanstack/react-table';

import { type StartTime, Duration } from 'utils/duration';

import DurationCell, { type DurationCellHandle } from './DurationCell';
import TimeCell, { type TimeCellHandle } from './TimeCell';
import type { PropagationMode, TimesStopsRowNew } from './types';

type StartTimeCellProps = {
  type: 'time' | 'duration';
  cellContext: CellContext<TimesStopsRowNew, StartTime | null>;
} & React.InputHTMLAttributes<HTMLInputElement> & {
    /** Reference date used as the calendar day base. If the entered time is before this date, the next day is assumed. */
    referenceDate?: Date;
    /** When the cell is empty, pre-fill the input with this value when the user focuses to edit. */
    prefillValue?: StartTime | null;
    /** Title for the clear button. */
    clearButtonTitle?: string;
    /** Called after Enter validates the input. Use to move focus (e.g. to the cell below). */
    onEnterKeyDown?: () => void;
    /** Called on Tab key to move focus to the next/previous editable time cell. */
    onTabKeyDown?: (direction: 'forward' | 'backward') => boolean;
    onCommit?: (date: StartTime | null, propagationMode: PropagationMode) => void;
    disableClear?: boolean;
    ref?: React.Ref<TimeCellHandle | DurationCellHandle>;
  };

const StartTimeCell = ({
  type,
  cellContext,
  referenceDate,
  prefillValue,
  clearButtonTitle,
  onEnterKeyDown,
  onTabKeyDown,
  onCommit,
  disableClear,
  ...props
}: StartTimeCellProps) => {
  if (type === 'time') {
    if (prefillValue && !(prefillValue instanceof Date)) {
      throw new Error('prefillValue must be a Date');
    }
    // Unfortunately, CellContext is a complicated type and cannot be narrowed
    // down, so we use a cast here.
    const timeCellContext = cellContext as CellContext<TimesStopsRowNew, Date | null>;
    return (
      <TimeCell
        {...timeCellContext}
        {...props}
        referenceDate={referenceDate}
        prefillValue={prefillValue}
        clearButtonTitle={clearButtonTitle}
        onEnterKeyDown={onEnterKeyDown}
        onTabKeyDown={onTabKeyDown}
        onCommit={onCommit}
        disableClear={disableClear}
      />
    );
  } else {
    if (prefillValue && !(prefillValue instanceof Duration)) {
      throw new Error('prefillValue must be a Duration');
    }
    // Unfortunately, CellContext is a complicated type and cannot be narrowed
    // down, so we use a cast here.
    const durationCellContext = cellContext as CellContext<TimesStopsRowNew, Duration | null>;
    return (
      <DurationCell
        {...durationCellContext}
        {...props}
        prefillValue={prefillValue}
        clearButtonTitle={clearButtonTitle}
        onEnterKeyDown={onEnterKeyDown}
        onTabKeyDown={onTabKeyDown}
        onCommit={(seconds, propagationMode) => {
          const dur = seconds !== null ? new Duration({ seconds }) : null;
          onCommit?.(dur, propagationMode);
        }}
        disableClear={disableClear}
        digital={true}
      />
    );
  }
};

export default StartTimeCell;
