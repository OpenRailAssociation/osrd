import type { TimesStopsRow, RequestedTimeField, TimeFillMode } from '../types';

export const getRowsToUpdateFromSimulation = (
  rows: TimesStopsRow[],
  field: RequestedTimeField,
  mode: TimeFillMode
): TimesStopsRow[] => {
  const computedField = field === 'requestedArrival' ? 'computedArrival' : 'computedDeparture';
  return rows.filter(
    (row) =>
      // The origin is excluded since its computed and requested times are always the same
      row.opOnPathIndex !== 0 &&
      row.pathStepId !== null &&
      row[computedField] !== null &&
      (mode === 'overwrite' || row[field] === null)
  );
};
