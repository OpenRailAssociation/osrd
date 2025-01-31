import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

import type { MissingFields } from '../types';

type FilterMissingFields = {
  missingFields: MissingFields[];
  rollingStock?: RollingStockWithLiveries;
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  origin?: StdcmPathStep;
  destination?: StdcmPathStep;
};

const filterMissingFields = ({
  missingFields,
  rollingStock,
  totalMass,
  totalLength,
  maxSpeed,
  origin,
  destination,
}: FilterMissingFields): MissingFields[] =>
  missingFields.filter((field) => {
    if (field === 'tractionEngine' && rollingStock) return false;
    if (field === 'totalMass' && !!totalMass) return false;
    if (field === 'totalLength' && !!totalLength) return false;
    if (field === 'maxSpeed' && !!maxSpeed) return false;
    if (field === 'origin' && origin?.location) return false;
    if (field === 'destination' && destination?.location) return false;
    return true;
  });

export default filterMissingFields;
