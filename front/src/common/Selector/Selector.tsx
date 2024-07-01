import React, { useState, type PropsWithChildren } from 'react';

import { Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isNull } from 'lodash';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import SelectNewItemButton from 'common/Selector/SelectNewItemButton';

const SelectorItem = <T extends string | null>({
  borderClass,
  canBeRemoved,
  extraColumn,
  index,
  isDefaultItem,
  isHovered,
  isSelected,
  item,
  title,
  onItemHovered,
  onItemRemoved,
  onItemSelected,
}: {
  borderClass?: string;
  canBeRemoved?: boolean;
  index: number;
  isDefaultItem: boolean;
  isSelected: boolean;
  isHovered: boolean;
  item: { id: T; label: string };
  title: string;
  onItemHovered: (item: T) => void;
  onItemRemoved?: (item: T) => void;
  onItemSelected?: (item: T) => void;
  extraColumn?: {
    defaultValue: string;
    data: {
      [key: string]: string;
    };
    updateData: (newData: { [key: string]: string }) => void;
  };
}) => {
  const inputValue = extraColumn?.data[item.id as string] || '';
  const isDisabled = isDefaultItem || !extraColumn;
  const isWarning = inputValue === '' && !isDisabled;

  return (
    <div className={cx({ 'd-flex ml-1': extraColumn })} key={`selector-${title}-${index}`}>
      <div
        className={cx('selector-item', 'd-flex', 'mb-1', borderClass, {
          'with-extra-column': extraColumn,
          selected: isSelected,
          hovered: isHovered,
        })}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (onItemSelected) onItemSelected(item.id);
        }}
        onMouseOver={() => {
          onItemHovered(item.id);
        }}
        onFocus={() => {
          onItemHovered(item.id);
        }}
        onMouseOut={() => {
          onItemHovered(null as T);
        }}
        onBlur={() => {
          onItemHovered(null as T);
        }}
        key={`selector-${title}-${index}`}
      >
        <div className="selector-item-name pt-1 pl-3" title={item.label}>
          {item.label}
        </div>
        {canBeRemoved && onItemRemoved && (
          <button
            type="button"
            tabIndex={0}
            onClick={(e) => {
              // This way, we won't trigger the onClick of the parent div
              e.stopPropagation();
              onItemRemoved(item.id);
            }}
            className="selector-trash-icon"
            aria-label="Delete item"
          >
            <Trash />
          </button>
        )}
      </div>
      {extraColumn && (
        <div
          className={cx('extra-column', 'mb-1', 'ml-3', {
            disabled: isDefaultItem,
            isWarning,
          })}
        >
          <InputSNCF
            id={`selector-${title}-${index}`}
            type="string"
            whiteBG
            sm
            noMargin
            disabled={isDefaultItem}
            value={isDefaultItem ? extraColumn.defaultValue : extraColumn.data[item.id as string]}
            onChange={(e) =>
              extraColumn.updateData({
                ...extraColumn.data,
                [item.id as string]: e.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  );
};

const Selector = <
  T extends string | null,
  // O extends NonNullable<T> because you can not add a null item (it's the item by default)
  O extends
    | NonNullable<T>
    | {
        id: NonNullable<T>;
        label: string;
      },
  // All of these 3 properties have to be defined for the extra column to work so we pass them in an object
>(
  props: PropsWithChildren<{
    borderClass?: string;
    title: string;
    displayedItems: { id: T; label: string }[];
    permanentItems?: T[];
    selectedItem?: T;
    onItemSelected?: (item: T) => void;
    onItemHovered?: (item: T) => void;
    onItemRemoved?: (item: T) => void;
    // Defined in case we use the selector to display some extra information
    extraColumn?: {
      defaultValue: string;
      // example: { powerRestrictionCode: powerClass }
      data: {
        [key: string]: string;
      };
      updateData: (newData: { [key: string]: string }) => void;
    };
    selectNewItemButtonProps?: {
      options: O[];
      authorizeNewItem?: boolean;
      addNewItemButtonText?: string;
      disabled?: boolean;
      selectNewItem: (arg: NonNullable<T>) => void;
      customOnClick?: () => void;
    };
    dataTestId?: string;
  }>
) => {
  const {
    borderClass = 'selector-blue',
    title,
    displayedItems,
    permanentItems,
    selectedItem,
    onItemSelected,
    onItemHovered,
    onItemRemoved,
    extraColumn,
    selectNewItemButtonProps,
    dataTestId,
  } = props;

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div className="selector" data-testid={dataTestId}>
      <div className={`selector-title ${borderClass} pl-1 pb-1`}>
        <h2 className="mb-0 text-blue">{title}</h2>
      </div>
      <div className="d-flex align-items-center position-relative selector-displayedItems-wrapper">
        <div className={`selector-body ${borderClass} overflow-auto p-2`}>
          {displayedItems.map((item, index: number) => (
            <SelectorItem
              key={index}
              borderClass={borderClass}
              canBeRemoved={!permanentItems || !permanentItems.includes(item.id)}
              extraColumn={extraColumn}
              index={index}
              isDefaultItem={isNull(item.id)}
              isHovered={!isNull(item.id) && hoveredItem === item.id}
              isSelected={selectedItem === item.id}
              item={item}
              title={title}
              onItemHovered={(newHoveredItem) => {
                setHoveredItem(newHoveredItem);
                if (onItemHovered) onItemHovered(newHoveredItem);
              }}
              onItemRemoved={onItemRemoved}
              onItemSelected={onItemSelected}
            />
          ))}
        </div>
      </div>
      {selectNewItemButtonProps && <SelectNewItemButton {...selectNewItemButtonProps} />}
    </div>
  );
};

export default Selector;
