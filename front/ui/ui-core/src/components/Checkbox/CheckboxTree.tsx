import React from 'react';

import CheckboxList from './CheckboxList';
import { type CheckboxTreeItem } from './type';
import { computeNewItemsTree as defaultComputeNewItemsTree } from './utils';
import FieldWrapper, { type FieldWrapperProps } from '../FieldWrapper';

export type CheckboxesTreeProps = Omit<FieldWrapperProps, 'children'> & {
  readOnly?: boolean;
  items: CheckboxTreeItem[];
  onChange?: (newItems: CheckboxTreeItem[], item: CheckboxTreeItem) => void;
  computeNewItemsTree?: (
    prevItemsTree: CheckboxTreeItem[],
    item: CheckboxTreeItem
  ) => CheckboxTreeItem[];
};

const CheckboxesTree = ({
  items,
  small,
  id,
  label,
  hint,
  disabled,
  required,
  readOnly,
  wrapperProps,
  onChange,
  computeNewItemsTree,
}: CheckboxesTreeProps) => {
  const handleClick = (
    e: React.MouseEvent<HTMLInputElement, MouseEvent>,
    item: CheckboxTreeItem
  ) => {
    const newItems = computeNewItemsTree
      ? computeNewItemsTree(items, item)
      : defaultComputeNewItemsTree(items, item);
    onChange?.(newItems, item);
    item.props.onClick?.(e);
  };

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      disabled={disabled}
      required={required}
      wrapperProps={
        wrapperProps?.withWrapper
          ? {
              ...wrapperProps,
              statusIconPosition: 'before-status-message',
            }
          : undefined
      }
      small={small}
    >
      <CheckboxList
        small={small}
        items={items}
        disabled={disabled}
        readOnly={readOnly}
        onClickItem={handleClick}
      />
    </FieldWrapper>
  );
};

export default CheckboxesTree;
