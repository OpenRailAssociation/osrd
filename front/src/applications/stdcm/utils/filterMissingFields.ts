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
  'viaConsistTotalMass',
  'viaConsistTotalLength',
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
        return totalMass === undefined;
      case 'totalLength':
        return totalLength === undefined;
      case 'maxSpeed':
        return maxSpeed === undefined;
      case 'origin':
        return !origin?.operationalPoint;
      case 'vias':
        return vias?.some((via) => !via.operationalPoint);
      case 'destination':
        return !destination?.operationalPoint;
      case 'viaConsistTotalMass':
        return vias?.some(
          (via) => via.isVia && via.consistChange && via.consistChange?.totalMass === undefined
        );
      case 'viaConsistTotalLength':
        return vias?.some(
          (via) => via.isVia && via.consistChange && via.consistChange?.totalLength === undefined
        );
      default:
        return false;
    }
  });
};

export default filterMissingFields;
