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
  'originCh',
  'vias',
  'viasCh',
  'destination',
  'destinationCh',
];

const filterMissingFields = ({
  missingFields,
  origin,
  vias,
  destination,
  checkAllFields = false,
}: FilterMissingFields): MissingFields[] => {
  const fieldsToCheck = checkAllFields ? ALL_MISSING_FIELDS : (missingFields ?? []);

  return fieldsToCheck.filter((field) => {
    switch (field) {
      case 'tractionEngine':
        return vias?.some((via) => via.consist && via.consist?.rollingStockID === undefined);
      case 'totalMass':
        return vias?.some((via) => via.consist && via.consist?.totalMass === undefined);
      case 'totalLength':
        return vias?.some((via) => via.consist && via.consist?.totalLength === undefined);
      case 'maxSpeed':
        return vias && vias[0].consist?.maxSpeed === undefined;
      case 'origin':
        return !origin?.operationalPoint;
      case 'originCh':
        return !!origin?.operationalPoint && !origin.operationalPoint.secondaryCode;
      case 'vias':
        return vias?.some((via) => !via.operationalPoint);
      case 'viasCh':
        return !!vias?.some((via) => via.operationalPoint && !via.operationalPoint.secondaryCode);
      case 'destination':
        return !destination?.operationalPoint;
      case 'destinationCh':
        return !!destination?.operationalPoint && !destination.operationalPoint.secondaryCode;
      default:
        return false;
    }
  });
};

export default filterMissingFields;
