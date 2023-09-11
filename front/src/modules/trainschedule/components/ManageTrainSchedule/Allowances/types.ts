import { EngineeringAllowance, RangeAllowance } from 'common/api/osrdEditoastApi';

export enum AllowancesTypes {
  standard = 'standard',
  engineering = 'engineering',
}
export type ManageAllowancesType = {
  type: AllowancesTypes;
  newAllowance?: RangeAllowance | EngineeringAllowance;
  allowanceIndexToDelete?: number;
};
export type FindAllowanceOverlapType = {
  allowances: RangeAllowance[] | EngineeringAllowance[];
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
