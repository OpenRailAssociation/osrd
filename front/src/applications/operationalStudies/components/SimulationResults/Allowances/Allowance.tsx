import React from 'react';
import { TFunction } from 'react-i18next';
import { identity, isNumber } from 'lodash';

import { FaTrash } from 'react-icons/fa';

import { Allowance, RangeAllowance, AllowanceValue } from 'common/api/osrdMiddlewareApi';
import { OsrdSimulationState } from 'reducers/osrdsimulation/types';
import { TYPES_UNITS, ALLOWANCE_UNITS_KEYS } from './allowancesConsts';

function valueWithUnits(allowanceValue: AllowanceValue | undefined, t: TFunction) {
  if (!allowanceValue) {
    return '';
  }
  const label = t(`allowanceTypes.${allowanceValue?.value_type}`);
  const unitSymbol = ALLOWANCE_UNITS_KEYS[allowanceValue.value_type];
  let value;
  // extremely dumb solution for now to comply with TS compiler.
  // the symbol (s, %, or min/100km) should be
  // added to the AllowanceValue, directly in the backend
  if (allowanceValue.value_type === 'time') {
    value = allowanceValue[TYPES_UNITS.time];
  } else if (allowanceValue.value_type === 'time_per_distance') {
    value = allowanceValue[TYPES_UNITS.time_per_distance];
  } else if (allowanceValue.value_type === 'percentage') {
    value = allowanceValue[TYPES_UNITS.percentage];
  }
  return `${label} /${value}${unitSymbol}`;
}

interface AllowanceProps<T> {
  data: T;
  distribution?: 'MARECO' | 'LINEAR';
  allowanceType?: Allowance['allowance_type'];
  delAllowance: (idx: number, allowanceType?: Allowance['allowance_type']) => void;
  idx: number;
  t: TFunction;
  selectedTrain: OsrdSimulationState['selectedTrain'];
  simulation: OsrdSimulationState['simulation']['present'];
}

function Allowance<T extends RangeAllowance>({
  data: { begin_position, end_position, value } = {} as T,
  distribution,
  allowanceType,
  delAllowance,
  idx,
  selectedTrain,
  simulation,
  t = identity,
}: AllowanceProps<T>) {
  const position2name = (position?: number) => {
    if (!isNumber(position)) {
      return '-';
    }
    const place = simulation.trains[selectedTrain].base.stops.find(
      (element) => element.position === position
    );
    return place && place.name !== null
      ? `${place.name} (${Math.round(position)}m)`
      : `${position}m`;
  };

  return (
    <div className="allowance-line">
      <div className="row align-items-center">
        <div className="col-md-1">
          <small>{idx + 1}</small>
        </div>
        <div className="col-md-2 text-left">{position2name(begin_position)}</div>
        <div className="col-md-3 text-center">{position2name(end_position)}</div>
        <div className="col-md-2 text-left">
          {t(`distributions.${distribution?.toLowerCase()}`)}
        </div>
        <div className="col-md-3 text-left">{valueWithUnits(value, t)}</div>
        <div className="col-md-1 d-flex align-items-right">
          <button
            type="button"
            className="btn btn-sm btn-only-icon btn-white text-danger"
            onClick={() => delAllowance(idx, allowanceType)}
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Allowance;
