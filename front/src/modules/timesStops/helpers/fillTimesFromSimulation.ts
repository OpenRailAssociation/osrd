import type { TimesStopsRowNew, RequestedTimeField, TimeFillMode } from '../types';

export const getRowsToUpdateFromSimulation = (
  rows: TimesStopsRowNew[],
  field: RequestedTimeField,
  mode: TimeFillMode
): TimesStopsRowNew[] => {
  const computedField = field === 'requestedArrival' ? 'computedArrival' : 'computedDeparture';
  return rows.filter(
    (row) =>
      row.pathStepId !== null &&
      row[computedField] !== null &&
      (mode === 'overwrite' || row[field] === null)
  );
};
