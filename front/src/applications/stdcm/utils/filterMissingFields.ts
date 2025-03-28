import { isNil } from 'lodash';

import type { StdcmPathStep } from 'reducers/osrdconf/types';

import type { MissingFields } from '../types';

type FilterMissingFields = {
  missingFields?: MissingFields[];
  rollingStockID?: number;
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  origin?: StdcmPathStep;
  vias?: StdcmPathStep[];
  destination?: StdcmPathStep;
  checkAllFields?: boolean;
};

const ALL_MISSING_FIELDS: MissingFields[] = [
  'tractionEngine',
  'totalMass',
  'totalLength',
  'maxSpeed',
  'origin',
  'vias',
  'destination',
];

const filterMissingFields = ({
  missingFields,
  rollingStockID,
  totalMass,
  totalLength,
  maxSpeed,
  origin,
  vias,
  destination,
  checkAllFields = false,
}: FilterMissingFields): MissingFields[] => {
  const fieldsToCheck = checkAllFields ? ALL_MISSING_FIELDS : (missingFields ?? []);

  return fieldsToCheck.filter((field) => {
    switch (field) {
      case 'tractionEngine':
        return !rollingStockID;
      case 'totalMass':
        return isNil(totalMass);
      case 'totalLength':
        return isNil(totalLength);
      case 'maxSpeed':
        return isNil(maxSpeed);
      case 'origin':
        return !origin?.location;
      case 'vias':
        return vias?.some((via) => !via.location) ?? false;
      case 'destination':
        return !destination?.location;
      default:
        return false;
    }
  });
};

export default filterMissingFields;
