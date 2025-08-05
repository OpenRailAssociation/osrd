import { kmhToMs } from 'utils/physics';

import type { DataSheetCurve, EffortCurveForm } from '../types';

const formatCurve = (rows: DataSheetCurve[]) =>
  rows.reduce<EffortCurveForm>(
    (result, row) => {
      result.speeds.push(row.speed !== null ? kmhToMs(Number(row.speed)) : null);
      // Back-end needs effort in newton
      result.max_efforts.push(row.effort !== null ? Number(row.effort) * 1000 : null);

      return result;
    },
    { max_efforts: [], speeds: [] }
  );

export default formatCurve;
