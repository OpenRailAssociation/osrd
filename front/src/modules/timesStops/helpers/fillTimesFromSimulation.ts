import type { TimesStopsRow, RequestedTimeField, TimeFillMode } from '../types';

export const getRowsToUpdateFromSimulation = (
  rows: TimesStopsRow[],
  field: RequestedTimeField,
  mode: TimeFillMode
): TimesStopsRow[] => {
  const computedField = field === 'requestedArrival' ? 'computedArrival' : 'computedDeparture';
  return rows.filter(
    (row) =>
      row.pathStepId !== null &&
      row[computedField] !== null &&
      (mode === 'overwrite' || row[field] === null)
  );
};
