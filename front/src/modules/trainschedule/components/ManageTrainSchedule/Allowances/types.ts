export enum AllowancesTypes {
  standard = 'standard',
  engineering = 'engineering',
}

export type AllowanceValueForm =
  | {
      value_type: 'time_per_distance';
      minutes?: number;
    }
  | {
      value_type: 'time';
      seconds?: number;
    }
  | {
      value_type: 'percentage';
      percentage?: number;
    };

export type RangeAllowanceForm = {
  begin_position: number;
  end_position: number;
  value: AllowanceValueForm;
};

export type StandardAllowanceForm = {
  allowance_type: 'standard';
  capacity_speed_limit?: number;
  default_value: AllowanceValueForm;
  distribution: 'MARECO' | 'LINEAR';
  ranges: RangeAllowanceForm[];
};

export type EngineeringAllowanceForm = {
  allowance_type: 'engineering';
  capacity_speed_limit?: number;
  distribution: 'MARECO' | 'LINEAR';
} & RangeAllowanceForm;

export type ManageAllowancesType = {
  type: AllowancesTypes;
  newAllowance?: RangeAllowanceForm | EngineeringAllowanceForm;
  allowanceIndexToDelete?: number;
};
export type FindAllowanceOverlapType = {
  allowances: RangeAllowanceForm[] | EngineeringAllowanceForm[];
  beginPosition: number;
  endPosition: number;
  currentAllowanceSelected?: number;
};
export type OverlapAllowancesIndexesType = [number | false, number | false];
export enum ActionOnAllowance {
  add = 'add',
  update = 'update',
  delete = 'delete',
}
export type SetAllowanceSelectedIndexType = (index: number | undefined) => void;
