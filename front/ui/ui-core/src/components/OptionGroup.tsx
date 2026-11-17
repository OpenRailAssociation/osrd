import React, { useEffect, useRef, useState, type ReactNode } from 'react';

import cx from 'classnames';

import useOutsideClick from '../hooks/useOutsideClick';
import { usePopoverPosition } from '../hooks/usePopoverPosition';

export type OptionGroupItem<T> = {
  value: T;
  label: string;
};

export type OptionGroupSection<T> = {
  title: string;
  items: OptionGroupItem<T>[];
  icon?: ReactNode;
};

export type OptionGroupProps<T> = {
  sections: OptionGroupSection<T>[];
  selectedValue?: T;
  onSelect: (value: T) => void;
  getItemKey: (value: T) => string;
};

const OptionGroup = <T,>({
  sections,
  selectedValue,
  onSelect,
  getItemKey,
}: OptionGroupProps<T>) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { popoverPosition, calculatePosition } = usePopoverPosition(
    triggerRef,
    panelRef,
    0,
    'start',
    'top'
  );

  const selectedKey = selectedValue !== undefined ? getItemKey(selectedValue) : undefined;
  const selectedSection = sections.find(({ items }) =>
    items.some(({ value }) => getItemKey(value) === selectedKey)
  );
  const selectedItem = selectedSection?.items.find(
    ({ value }) => getItemKey(value) === selectedKey
  );

  useEffect(() => {
    if (isOpen && panelRef.current && !panelRef.current.matches(':popover-open')) {
      panelRef.current.showPopover();
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  useOutsideClick(isOpen ? panelRef : null, () => setIsOpen(false));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ui-option-group-trigger"
        title={selectedItem?.label}
        onClick={() => setIsOpen(true)}
      >
        {!isOpen && selectedSection?.icon}
        <span className="option-group-trigger-label">{selectedItem?.label}</span>
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          className="ui-option-group"
          popover="manual"
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
        >
          {sections.map((section) => (
            <div key={section.title} className="option-group-section">
              <div className="option-group-section-title">{section.title}</div>
              {section.items.map((item) => {
                const itemKey = getItemKey(item.value);
                return (
                  <button
                    key={itemKey}
                    type="button"
                    className={cx('option-group-item', { selected: itemKey === selectedKey })}
                    title={item.label}
                    onClick={() => {
                      onSelect(item.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="option-group-item-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default OptionGroup;
