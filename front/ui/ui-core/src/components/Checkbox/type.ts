import { type CheckboxProps } from './Checkbox';

export enum CheckboxState {
  UNCHECKED,
  CHECKED,
  INDETERMINATE,
}

export type ItemStates = Record<number, CheckboxState>;

export type CheckboxTreeItem = {
  id: number;
  props: CheckboxProps;
  items?: CheckboxTreeItem[];
};

export type ParentChildrenMap = Record<number, number[]>; // Maps parent ID to child IDs
export type ChildrenParentMap = Record<number, number>; // Maps child ID to parent ID
